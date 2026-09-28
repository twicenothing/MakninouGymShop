using MakninouAPI.Data;
using MakninouAPI.DTOs;
using MakninouAPI.Models;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace MakninouAPI.Services;

public class ProductService
{
    private readonly MakninouDBContext _context;


    public ProductService(MakninouDBContext context)
    {
        _context = context;
    }

    public async Task<Product?> AddProduct(ProductCreateDTO request)
    {
        ValidateProduct(request.ProductName, request.Category, request.UnitPrice, request.Description);
        var newProduct = new Product { ProductName = request.ProductName, Description = request.Description, ProductUnitPriceDZD = request.UnitPrice, ProductCategory = request.Category, IsWomenProduct = request.isWomenProduct };


        try
        {
            await _context.Products.AddAsync(newProduct);

            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException e) when (e.InnerException is PostgresException
        {
            SqlState: PostgresErrorCodes.UniqueViolation,
            ConstraintName: "IX_Products_ProductName"
        })
        {
            _context.Entry(newProduct).State = EntityState.Detached;
            throw new DuplicateProductNameException(e);
        }
        catch (Exception e)
        {


            Console.WriteLine(e.Message);
            return null;
        }
     
        return newProduct;
    }


    public async Task<Product?> UpdateProduct(int id, ProductUpdateDTO request)
    {
        ValidateProduct(request.ProductName, request.Category, request.UnitPrice, request.Description);
        var product = await _context.Products.FindAsync(id);
        if (product is null)
            return null;

        product.ProductName = request.ProductName;
        product.ProductCategory = request.Category;
        product.ProductUnitPriceDZD = request.UnitPrice;
        product.Description = request.Description;
        product.IsWomenProduct = request.IsWomenProduct;
        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException e) when (e.InnerException is PostgresException
        {
            SqlState: PostgresErrorCodes.UniqueViolation,
            ConstraintName: "IX_Products_ProductName"
        })
        {
            _context.Entry(product).State = EntityState.Detached;
            throw new DuplicateProductNameException(e);
        }
        return product;
    }

    private static void ValidateProduct(string name, ProductCategory category, int price, string description)
    {
        if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(description))
            throw new ArgumentException("Product name and description are required.");
        if (price < 0 || !Enum.IsDefined(category))
            throw new ArgumentException("Price must be nonnegative and category must be valid.");
    }

    public async Task<Product?> GetProductById(int id)
    {
        var foundProduct = await _context.Products.FindAsync(id);

        return foundProduct;

    }


    

    public async Task<IEnumerable<Product>> GetProductsByCategory(string? category)
    {

        if (string.IsNullOrWhiteSpace(category))
            return await _context.Products.AsNoTracking().ToListAsync();

        if (!Enum.TryParse<ProductCategory>(category, ignoreCase: true, out var parsedCategory)
         || !Enum.IsDefined(parsedCategory))
        {
            throw new ArgumentException(
                $"Invalid category. Use {string.Join(", ", Enum.GetNames<ProductCategory>())}.",
                nameof(category));
        }
        return await _context.Products
      .AsNoTracking()
      .Where(product => product.ProductCategory == parsedCategory)
      .ToListAsync();
    }

    public async Task<IEnumerable<Product>> GetWomenProducts()
    {
        return await _context.Products.AsNoTracking().Where(product => product.IsWomenProduct == true).ToListAsync();

    }

    public async Task<bool> DeleteProductById(int id)
    {
        var product = await _context.Products.FindAsync(id);

        if(product is null)
        {

            return false;
        }

        _context.Products.Remove(product);
        int result = await _context.SaveChangesAsync();
        return result > 0;

    }

    // SalesCount is updated transactionally when an order is created, including pack components.
    // Return IDs only so this public endpoint exposes no order or customer information.
    public async Task<List<int>> GetBestSellerIds()
    {
        return await _context.Products.AsNoTracking()
            .Where(product => product.SalesCount > 0)
            .OrderByDescending(product => product.SalesCount)
            .ThenBy(product => product.Id)
            .Select(product => product.Id)
            .Take(4)
            .ToListAsync();
    }

    public async Task<Product?> AdjustStock(int id, int amount)
    {
        if (amount == 0)
            throw new ArgumentException("Stock adjustment cannot be zero.", nameof(amount));

        var query = _context.Products.Where(product => product.Id == id);
        if (amount < 0)
        {
            var decrease = (long)amount * -1;
            query = query.Where(product => product.StockQuantity >= decrease);
        }

        var updated = await query.ExecuteUpdateAsync(setters => setters
            .SetProperty(product => product.StockQuantity,
                product => product.StockQuantity + amount));

        if (updated == 0)
        {
            var exists = await _context.Products.AnyAsync(product => product.Id == id);
            if (!exists)
                return null;

            throw new InsufficientStockException("Stock cannot be reduced below zero.");
        }

        return await _context.Products
            .AsNoTracking()
            .SingleAsync(product => product.Id == id);
    }

}
