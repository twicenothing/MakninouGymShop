namespace MakninouAPI.DTOs;

public record OrderCreateDTO(
    string CustomerPhoneNumber,
    string CustomerFullName,
    string CustomerAdress,
    List<OrderItemCreateDTO> Items);

// The client can send EITHER a ProductId OR a PackId (exactly one).
public record OrderItemCreateDTO(
    int? ProductId,
    int? PackId,
    int Quantity);

public record OrderItemResponseDTO(
    int? ProductId,
    int? PackId,
    string ItemName,        // product name OR pack name
    int Quantity,
    int UnitPriceDZD);

public record OrderResponseDTO(
    int Id,
    DateTime CreatedAt,
    int Status,
    string CustomerFullName,
    string CustomerPhoneNumber,
    string CustomerAdress,
    List<OrderItemResponseDTO> Items);