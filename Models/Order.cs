namespace MakninouAPI.Models;


public enum OrderStatus  {Pending, InDelivery, Delivered, Cancelled};

public class Order
{
    public int Id { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public OrderStatus Status { get; set; } = OrderStatus.Pending;


    public string CustomerPhoneNumber { get; set; } = string.Empty;


    public string CustomerFullName {  get; set; } = string.Empty;

    public string CustomerAdress {  get; set; } = string.Empty;
    public List<OrderItem> Items { get; set; } = new();


}
