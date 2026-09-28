using MakninouAPI.Data;
using MakninouAPI.Models;

namespace MakninouAPI.Services;

public sealed class ProductImageService
{
    private const long MaxFileSize = 5 * 1024 * 1024;
    private static readonly Dictionary<string, string> AllowedTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        ["image/jpeg"] = ".jpg",
        ["image/png"] = ".png",
        ["image/webp"] = ".webp"
    };

    private readonly MakninouDBContext _db;
    private readonly string _imageDirectory;

    public ProductImageService(MakninouDBContext db, IWebHostEnvironment environment)
    {
        _db = db;
        var webRoot = environment.WebRootPath ?? Path.Combine(environment.ContentRootPath, "wwwroot");
        _imageDirectory = Path.Combine(webRoot, "uploads", "products");
    }

    public async Task<Product?> ReplaceAsync(int productId, IFormFile image, CancellationToken cancellationToken)
    {
        var product = await _db.Products.FindAsync([productId], cancellationToken);
        if (product is null) return null;

        if (image.Length == 0 || image.Length > MaxFileSize)
            throw new ArgumentException("The image must be between 1 byte and 5 MB.");
        if (!AllowedTypes.TryGetValue(image.ContentType, out var extension))
            throw new ArgumentException("Use a JPG, PNG or WebP image.");

        Directory.CreateDirectory(_imageDirectory);
        var fileName = $"{Guid.NewGuid():N}{extension}";
        var destination = Path.Combine(_imageDirectory, fileName);

        await using (var stream = new FileStream(destination, FileMode.CreateNew, FileAccess.Write, FileShare.None))
            await image.CopyToAsync(stream, cancellationToken);

        var previousUrl = product.ImageUrl;
        product.ImageUrl = $"/uploads/products/{fileName}";
        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            File.Delete(destination);
            throw;
        }

        DeleteLocalFile(previousUrl);
        return product;
    }

    public async Task<Product?> RemoveAsync(int productId, CancellationToken cancellationToken)
    {
        var product = await _db.Products.FindAsync([productId], cancellationToken);
        if (product is null) return null;

        var previousUrl = product.ImageUrl;
        product.ImageUrl = null;
        await _db.SaveChangesAsync(cancellationToken);
        DeleteLocalFile(previousUrl);
        return product;
    }

    public void DeleteLocalFile(string? imageUrl)
    {
        if (string.IsNullOrWhiteSpace(imageUrl)) return;
        var fileName = Path.GetFileName(imageUrl);
        if (string.IsNullOrWhiteSpace(fileName)) return;
        var path = Path.Combine(_imageDirectory, fileName);
        if (File.Exists(path)) File.Delete(path);
    }
}
