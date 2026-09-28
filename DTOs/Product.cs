using MakninouAPI.Models;

namespace MakninouAPI.DTOs;

public record ProductCreateDTO
(
    string ProductName,
    ProductCategory Category,
    int UnitPrice,
    string Description,
    bool isWomenProduct


    );
