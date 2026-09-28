using MakninouAPI.Data;
using MakninouAPI.DTOs;

using MakninouAPI.Models;
using Microsoft.EntityFrameworkCore;

namespace MakninouAPI.Services;

public class PackService
{

    private readonly MakninouDBContext _dbContext;

    public PackService(MakninouDBContext dbContext) {  _dbContext = dbContext; }


    public async Task<List<PackResponseDTO>> GetAllPacksAsync(
       CancellationToken cancellationToken = default, bool includeInactive = false)
    {
        return await _dbContext.Packs
            .Where(p => includeInactive || p.IsActive)
            .OrderBy(p => p.PackName)
            .Select(p => new PackResponseDTO(
                p.Id,
                p.PackName,
                p.Description,
                p.PackPriceDZD,
                p.Items.Sum(i => i.Product.ProductUnitPriceDZD * i.Quantity),
                p.Items.Sum(i => i.Product.ProductUnitPriceDZD * i.Quantity) - p.PackPriceDZD,
                p.IsActive,
                p.Items.Select(i => new PackItemResponseDTO(
                    i.ProductId,
                    i.Product.ProductName,
                    i.Quantity,
                    i.Product.ProductUnitPriceDZD
                )).ToList()
            ))
            .ToListAsync(cancellationToken);
    }
    public async Task<PackResponseDTO?> GetPackByIdAsync(
     int id,
     CancellationToken cancellationToken = default)
    {
        return await _dbContext.Packs
            .Where(p => p.Id == id)
            .Select(p => new PackResponseDTO(
                p.Id,
                p.PackName,
                p.Description,
                p.PackPriceDZD,
                p.Items.Sum(i => i.Product.ProductUnitPriceDZD * i.Quantity),
                p.Items.Sum(i => i.Product.ProductUnitPriceDZD * i.Quantity) - p.PackPriceDZD,
                p.IsActive,
                p.Items.Select(i => new PackItemResponseDTO(
                    i.ProductId,
                    i.Product.ProductName,
                    i.Quantity,
                    i.Product.ProductUnitPriceDZD
                )).ToList()
            ))
            .FirstOrDefaultAsync(cancellationToken);
    }

    // ---------------------------------------------------------------
    // CREATE
    // ---------------------------------------------------------------
    public async Task<PackResponseDTO> CreatePackAsync(
        PackCreateDTO dto,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(dto);

        if (string.IsNullOrWhiteSpace(dto.PackName))
            throw new ArgumentException("Pack name is required.");

        if (dto.PackPriceDZD <= 0)
            throw new ArgumentException("Pack price must be greater than zero.");

        if (dto.Items is null || dto.Items.Count == 0)
            throw new ArgumentException("A pack must contain at least one product.");

        foreach (var item in dto.Items)
        {
            if (item is null || item.ProductId <= 0 || item.Quantity <= 0)
                throw new ArgumentException("Each item must have a valid product id and a positive quantity.");
        }

        if (dto.Items.Select(i => i.ProductId).Distinct().Count() != dto.Items.Count)
            throw new ArgumentException("Include each product once, with the desired quantity.");

        var name = dto.PackName.Trim();

        var nameTaken = await _dbContext.Packs
            .AnyAsync(p => p.PackName == name, cancellationToken);
        if (nameTaken)
            throw new InvalidOperationException($"A pack named '{name}' already exists.");

        // Verify all products exist
        var productIds = dto.Items.Select(i => i.ProductId).ToList();
        var found = await _dbContext.Products
            .Where(p => productIds.Contains(p.Id))
            .Select(p => p.Id)
            .ToListAsync(cancellationToken);

        var missing = productIds.Except(found).ToList();
        if (missing.Count > 0)
            throw new KeyNotFoundException(
                $"Product(s) not found: {string.Join(", ", missing)}.");

        var pack = new Pack
        {
            PackName = name,
            Description = dto.Description?.Trim() ?? string.Empty,
            PackPriceDZD = dto.PackPriceDZD,
            IsActive = true,
            Items = dto.Items.Select(i => new PackItem
            {
                ProductId = i.ProductId,
                Quantity = i.Quantity
            }).ToList()
        };

        _dbContext.Packs.Add(pack);
        await _dbContext.SaveChangesAsync(cancellationToken);

        // Reload as DTO so computed fields (Original/Savings) are correct
        return await GetPackByIdAsync(pack.Id, cancellationToken)
               ?? throw new InvalidOperationException("Failed to load created pack.");
    }

    // ---------------------------------------------------------------
    // UPDATE (name, desc, price, active, items)
    // ---------------------------------------------------------------
    public async Task<PackResponseDTO> UpdatePackAsync(
        int id,
        PackCreateDTO dto,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(dto);

        if (string.IsNullOrWhiteSpace(dto.PackName))
            throw new ArgumentException("Pack name is required.");

        if (dto.PackPriceDZD <= 0)
            throw new ArgumentException("Pack price must be greater than zero.");

        if (dto.Items is null || dto.Items.Count == 0)
            throw new ArgumentException("A pack must contain at least one product.");

        foreach (var item in dto.Items)
        {
            if (item is null || item.ProductId <= 0 || item.Quantity <= 0)
                throw new ArgumentException("Each item must have a valid product id and a positive quantity.");
        }

        if (dto.Items.Select(i => i.ProductId).Distinct().Count() != dto.Items.Count)
            throw new ArgumentException("Include each product once, with the desired quantity.");

        var pack = await _dbContext.Packs
            .Include(p => p.Items)
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken)
            ?? throw new KeyNotFoundException($"Pack {id} was not found.");

        var name = dto.PackName.Trim();

        var nameTaken = await _dbContext.Packs
            .AnyAsync(p => p.PackName == name && p.Id != id, cancellationToken);
        if (nameTaken)
            throw new InvalidOperationException($"A pack named '{name}' already exists.");

        var productIds = dto.Items.Select(i => i.ProductId).ToList();
        var found = await _dbContext.Products
            .Where(p => productIds.Contains(p.Id))
            .Select(p => p.Id)
            .ToListAsync(cancellationToken);

        var missing = productIds.Except(found).ToList();
        if (missing.Count > 0)
            throw new KeyNotFoundException(
                $"Product(s) not found: {string.Join(", ", missing)}.");

        pack.PackName = name;
        pack.Description = dto.Description?.Trim() ?? string.Empty;
        pack.PackPriceDZD = dto.PackPriceDZD;

        // Update retained components in place, avoiding delete/insert unique-key conflicts.
        foreach (var existing in pack.Items.ToList())
        {
            var replacement = dto.Items.SingleOrDefault(i => i.ProductId == existing.ProductId);
            if (replacement is null)
            {
                _dbContext.PackItems.Remove(existing);
                pack.Items.Remove(existing);
            }
            else existing.Quantity = replacement.Quantity;
        }
        foreach (var item in dto.Items.Where(i => !pack.Items.Any(existing => existing.ProductId == i.ProductId)))
            pack.Items.Add(new PackItem { PackId = pack.Id, ProductId = item.ProductId, Quantity = item.Quantity });

        await _dbContext.SaveChangesAsync(cancellationToken);

        return await GetPackByIdAsync(pack.Id, cancellationToken)
               ?? throw new InvalidOperationException("Failed to load updated pack.");
    }

    // ---------------------------------------------------------------
    // TOGGLE ACTIVE (soft enable/disable)
    // ---------------------------------------------------------------
    public async Task SetPackActiveAsync(
        int id,
        bool isActive,
        CancellationToken cancellationToken = default)
    {
        var pack = await _dbContext.Packs
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken)
            ?? throw new KeyNotFoundException($"Pack {id} was not found.");

        pack.IsActive = isActive;
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    // ---------------------------------------------------------------
    // DELETE (hard delete — PackItems cascade)
    // ---------------------------------------------------------------
    public async Task DeletePackAsync(
        int id,
        CancellationToken cancellationToken = default)
    {
        var pack = await _dbContext.Packs
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken)
            ?? throw new KeyNotFoundException($"Pack {id} was not found.");

        // Optional: prevent deleting a pack that's referenced in orders.
        var usedInOrders = await _dbContext.OrderItems
            .AnyAsync(oi => oi.PackId == id, cancellationToken);
        if (usedInOrders)
            throw new InvalidOperationException(
                "This pack has been used in orders and cannot be deleted. Deactivate it instead.");

        _dbContext.Packs.Remove(pack);
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

}
