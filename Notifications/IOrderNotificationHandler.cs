namespace MakninouAPI.Notifications;

public interface IOrderNotificationHandler
{
    Task HandleAsync(OrderCreatedEvent order, CancellationToken cancellationToken);
}
