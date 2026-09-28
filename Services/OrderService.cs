using MakninouAPI.Data;
using MakninouAPI.DTOs;
using MakninouAPI.Models;
using MakninouAPI.Notifications;
using Microsoft.EntityFrameworkCore;

namespace MakninouAPI.Services;

public class OrderService(
    MakninouDBContext context,
    IOrderNotificationPublisher notificationPublisher)
{
    public async Task<Order> CreateOrder(OrderCreateDTO request, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (string.IsNullOrWhiteSpace(request.CustomerFullName)
            || string.IsNullOrWhiteSpace(request.CustomerPhoneNumber)
            || string.IsNullOrWhiteSpace(request.CustomerAdress))
            throw new ArgumentException("Customer name, phone number and address are required.");

        if (request.Items is null || request.Items.Count == 0)
            throw new ArgumentException("An order must contain at least one item.");

        // Each item must reference exactly one of ProductId / PackId, with positive qty.
        foreach (var item in request.Items)
        {
            if (item is null || item.Quantity <= 0)
                throw new ArgumentException("Each item must have a positive quantity.");

            if (item.ProductId is <= 0 || item.PackId is <= 0)
                throw new ArgumentException("Product and pack IDs must be positive.");
            var hasProduct = item.ProductId.HasValue;
            var hasPack = item.PackId.HasValue;

            if (hasProduct == hasPack)
                throw new ArgumentException(
                    "Each item must reference either a product or a pack, but not both/neither.");
        }

        // No duplicate product lines, no duplicate pack lines.
        var duplicateProduct = request.Items
            .Where(i => i.ProductId is > 0)
            .GroupBy(i => i.ProductId!.Value)
            .Any(g => g.Count() > 1);
        if (duplicateProduct)
            throw new ArgumentException("Include each product once, with the desired quantity.");

        var duplicatePack = request.Items
            .Where(i => i.PackId is > 0)
            .GroupBy(i => i.PackId!.Value)
            .Any(g => g.Count() > 1);
        if (duplicatePack)
            throw new ArgumentException("Include each pack once, with the desired quantity.");

        await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);

        var order = new Order
        {
            CustomerFullName = request.CustomerFullName.Trim(),
            CustomerPhoneNumber = request.CustomerPhoneNumber.Trim(),
            CustomerAdress = request.CustomerAdress.Trim()
        };

        // ---- 1. Load everything we need ----
        var directProductIds = request.Items
            .Where(i => i.ProductId is > 0)
            .Select(i => i.ProductId!.Value)
            .ToList();

        var packIds = request.Items
            .Where(i => i.PackId is > 0)
            .Select(i => i.PackId!.Value)
            .ToList();

        var directProducts = await context.Products.AsNoTracking()
            .Where(p => directProductIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, cancellationToken);

        // Load packs with their items AND the component products (needed for stock + name/price)
        var packs = await context.Packs.AsNoTracking()
            .Include(p => p.Items)
                .ThenInclude(pi => pi.Product)
            .Where(p => packIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, cancellationToken);

        // Fail fast if any referenced entity is missing
        foreach (var id in directProductIds)
            if (!directProducts.ContainsKey(id))
                throw new KeyNotFoundException($"Product {id} was not found.");

        foreach (var id in packIds)
            if (!packs.ContainsKey(id))
                throw new KeyNotFoundException($"Pack {id} was not found.");

        if (packs.Values.Any(p => !p.IsActive || p.Items.Count == 0))
            throw new InsufficientStockException("This pack is no longer available.");

        // ---- 2. Aggregate required stock per underlying product ----
        // key = productId, value = total quantity to subtract
        var requiredStock = new Dictionary<int, long>();
        void RequireStock(int productId, long quantity)
        {
            if (quantity <= 0 || quantity > int.MaxValue - requiredStock.GetValueOrDefault(productId))
                throw new InsufficientStockException("Requested quantity exceeds available stock.");
            requiredStock[productId] = requiredStock.GetValueOrDefault(productId) + quantity;
        }

        foreach (var item in request.Items)
        {
            if (item.ProductId is int pid)
            {
                RequireStock(pid, item.Quantity);
            }
            else if (item.PackId is int packId)
            {
                foreach (var packItem in packs[packId].Items)
                {
                    var need = (long)packItem.Quantity * item.Quantity;
                    RequireStock(packItem.ProductId, need);
                }
            }
        }

        // ---- 3. Decrement stock and increment sales, sorted by product id for consistent lock order ----
        // Both changes are part of the order transaction, so a failed order changes neither value.
        foreach (var (productId, requiredQuantity) in requiredStock.OrderBy(kv => kv.Key))
        {
            if (requiredQuantity > int.MaxValue || requiredQuantity <= 0)
                throw new InsufficientStockException("Requested quantity exceeds available stock.");
            var qty = (int)requiredQuantity;
            var updated = await context.Products
                .Where(p => p.Id == productId && p.StockQuantity >= qty)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(p => p.StockQuantity, p => p.StockQuantity - qty)
                    .SetProperty(p => p.SalesCount, p => p.SalesCount + qty),
                    cancellationToken);

            if (updated == 0)
            {
                // We need the product name for a good error message.
                var name = directProducts.TryGetValue(productId, out var dp)
                    ? dp.ProductName
                    : packs.Values.SelectMany(p => p.Items)
                           .FirstOrDefault(pi => pi.ProductId == productId)?.Product.ProductName
                      ?? $"Product {productId}";

                throw new InsufficientStockException($"Insufficient stock for product {name}.");
            }
        }

        // ---- 4. Build OrderItems (one line per request item, snapshot name + price) ----
        var orderItems = new List<OrderItem>();
        var notificationItems = new List<OrderCreatedItem>();

        foreach (var item in request.Items)
        {
            if (item.ProductId is int pid)
            {
                var product = directProducts[pid];
                orderItems.Add(new OrderItem
                {
                    Order = order,
                    ProductId = product.Id,
                    Quantity = item.Quantity,
                    UnitPriceDZD = product.ProductUnitPriceDZD,
                    ItemName = product.ProductName
                });

                notificationItems.Add(new OrderCreatedItem(
                    product.Id, product.ProductName, item.Quantity, product.ProductUnitPriceDZD));
            }
            else if (item.PackId is int packId)
            {
                var pack = packs[packId];
                orderItems.Add(new OrderItem
                {
                    Order = order,
                    PackId = pack.Id,
                    Quantity = item.Quantity,
                    UnitPriceDZD = pack.PackPriceDZD,
                    ItemName = pack.PackName
                });

                // For the notification, you probably want the pack as a single line.
                // If you'd rather notify each component, expand pack.Items here instead.
                notificationItems.Add(new OrderCreatedItem(
                    pack.Id, pack.PackName, item.Quantity, pack.PackPriceDZD));
            }
        }

        context.OrderItems.AddRange(orderItems);
        await context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        await notificationPublisher.PublishAsync(new OrderCreatedEvent(
            order.Id,
            order.CustomerFullName,
            order.CustomerPhoneNumber,
            order.CustomerAdress,
            notificationItems), CancellationToken.None);

        return order;
    }
    public async Task<List<OrderResponseDTO>> GetAllOrdersAsync()
    {
        return await context.Orders
            .OrderByDescending(o => o.CreatedAt)
            .Select(o => new OrderResponseDTO(
                o.Id,
                o.CreatedAt,
                (int)o.Status,
                o.CustomerFullName,
                o.CustomerPhoneNumber,
                o.CustomerAdress,
                o.Items.Select(i => new OrderItemResponseDTO(
                    i.ProductId,
                    i.PackId,
                    i.ItemName,                  // snapshot, set at order time
                    i.Quantity,
                    i.UnitPriceDZD
                )).ToList()
            ))
            .ToListAsync();
    }
    public async Task<bool> ConfirmeOrder(int id)
    {
        var order = await context.Orders.FindAsync(id);
        if (order == null)
        {
            return false;
        }
        order.Status = OrderStatus.InDelivery;
        await context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> CancelOrder(int id)
    {
        var order = await context.Orders.FindAsync(id);
        if (order == null)
        {
            return false;
        }
        order.Status = OrderStatus.Cancelled;
        await context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> MarkAsDelivered(int id)
    {
        var order = await context.Orders.FindAsync(id);
        if (order == null)
        {
            return false;
        }
        order.Status = OrderStatus.Delivered;
        await context.SaveChangesAsync();
        return true;
    }
}

public sealed class InsufficientStockException(string message) : Exception(message)
{
}
