namespace MakninouAPI.Notifications;

public sealed class OrderNotificationWorker(
    OrderNotificationQueue queue,
    IOrderNotificationHandler handler,
    ILogger<OrderNotificationWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var order in queue.ReadAllAsync(stoppingToken))
        {
            try
            {
                await handler.HandleAsync(order, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "Could not send notification for order {OrderId}", order.OrderId);
            }
        }
    }
}
