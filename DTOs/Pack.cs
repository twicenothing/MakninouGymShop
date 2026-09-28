namespace MakninouAPI.DTOs;


// ---------- Input ----------

public record PackCreateDTO(
    string PackName,
    string Description,
    int PackPriceDZD,
    List<PackItemCreateDTO> Items);

public record PackItemCreateDTO(int ProductId, int Quantity);

// ---------- Output ----------

public record PackItemResponseDTO(
    int ProductId,
    string ProductName,
    int Quantity,
    int ProductUnitPriceDZD);

public record PackResponseDTO(
    int Id,
    string PackName,
    string Description,
    int PackPriceDZD,
    int OriginalPriceDZD,
    int SavingsDZD,
    bool IsActive,
    List<PackItemResponseDTO> Items);