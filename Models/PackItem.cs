namespace MakninouAPI.Models;

public class PackItem
{
    public int Id { get; set; }

    public int PackId { get; set; }
    public Pack Pack { get; set; } = null!;

    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;

    // How many of this product are in the pack
    public int Quantity { get; set; } = 1;
}