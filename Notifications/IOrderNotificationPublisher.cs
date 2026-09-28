namespace MakninouAPI.Notifications;

public interface IOrderNotificationPublisher
{
    ValueTask PublishAsync(OrderCreatedEvent order, CancellationToken cancellationToken = default);
}
