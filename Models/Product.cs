using System.ComponentModel.DataAnnotations;

namespace MakninouAPI.Models;



public enum ProductCategory {Proteine, Creatine, MassGainer, PreWorkout, Vitamin, Snack,Boisson, Booster, FatBurner, AcidesAmine, Collagene};


public class Product
{
    public int Id { get; set; }

    [Required]
    public required string ProductName { get; set; }

    public required string Description { get; set; }

    [Required]

    public int ProductUnitPriceDZD { get; set; }

    public int StockQuantity { get; set; } = 1;

    // Total units sold through direct product lines and as components of packs.
    public long SalesCount { get; set; }

    public ProductCategory ProductCategory { get; set; }

    public bool IsActive  => StockQuantity > 0;

    public bool IsWomenProduct { get; set; }

    // Relative public URL for the image stored under wwwroot/uploads/products.
    public string? ImageUrl { get; set; }

    public List<PackItem> Packs { get; set; } = new();
}
