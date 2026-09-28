using System.Threading.Channels;

namespace MakninouAPI.Notifications;

public sealed class OrderNotificationQueue : IOrderNotificationPublisher
{
    private readonly Channel<OrderCreatedEvent> _queue =
        Channel.CreateBounded<OrderCreatedEvent>(new BoundedChannelOptions(100)
        {
            FullMode = BoundedChannelFullMode.Wait,
            SingleReader = true,
            SingleWriter = false
        });

    public ValueTask PublishAsync(OrderCreatedEvent order, CancellationToken cancellationToken = default) =>
        _queue.Writer.WriteAsync(order, cancellationToken);

    public IAsyncEnumerable<OrderCreatedEvent> ReadAllAsync(CancellationToken cancellationToken) =>
        _queue.Reader.ReadAllAsync(cancellationToken);
}
