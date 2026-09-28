
namespace MakninouAPI.Models;

public class OrderItem
{
    public int Id { get; set; }

    public int OrderId { get; set; }
    public Order Order { get; set; } = null!;

    public int? ProductId { get; set; }      // was: int
    public Product? Product { get; set; }    // was: Product

    public int? PackId { get; set; }         // NEW
    public Pack? Pack { get; set; }          // NEW

    public int Quantity { get; set; }
    public int UnitPriceDZD { get; set; }

    public string ItemName { get; set; } = string.Empty;   // NEW — snapshot
}