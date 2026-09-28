using System.ComponentModel.DataAnnotations;

namespace MakninouAPI.Models;


public class Pack
{
    public int Id { get; set; }

    [Required]
    public required string PackName { get; set; }

    public string Description { get; set; } = string.Empty;

    // The price the customer pays for the whole combo (usually < sum of parts)
    public int PackPriceDZD { get; set; }

    // Optional: original price (sum of parts) for showing a "was X, now Y" discount.
    // You can store it, or compute it in the DTO. Storing = price snapshot.
    public int? OriginalPriceDZD { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<PackItem> Items { get; set; } = new();
}