using MakninouAPI.Models;

namespace MakninouAPI.DTOs;

public record ProductUpdateDTO(
    string ProductName,
    ProductCategory Category,
    int UnitPrice,
    string Description,
    bool IsWomenProduct);
