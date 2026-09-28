namespace MakninouAPI.Notifications;

public sealed record OrderCreatedEvent(
    int OrderId,
    string CustomerFullName,
    string CustomerPhoneNumber,
    string CustomerAdress,
    IReadOnlyList<OrderCreatedItem> Items);

public sealed record OrderCreatedItem(
    int ProductId,
    string ProductName,
    int Quantity,
    int UnitPriceDZD);
