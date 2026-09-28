using System.Net;
using System.Net.Mail;

namespace MakninouAPI.Notifications;

public sealed class EmailNotificationHandler(
    IConfiguration configuration,
    ILogger<EmailNotificationHandler> logger) : IOrderNotificationHandler
{
    public async Task HandleAsync(OrderCreatedEvent order, CancellationToken cancellationToken)
    {
        var host = Required("Email:SmtpHost");
        var port = configuration.GetValue<int>("Email:SmtpPort", 587);
        var username = Required("Email:SmtpUsername");
        var password = Required("Email:SmtpPassword");
        var sender = Required("Email:From");
        var recipient = Required("Email:OwnerAddress");

        using var message = new MailMessage(sender, recipient)
        {
            Subject = $"New order #{order.OrderId}",
            Body = BuildBody(order)
        };
        using var client = new SmtpClient(host, port)
        {
            EnableSsl = true,
            Credentials = new NetworkCredential(username, password)
        };

        await client.SendMailAsync(message, cancellationToken);
        logger.LogInformation("Order notification sent for order {OrderId}", order.OrderId);
    }

    private string Required(string key) => configuration[key] is { Length: > 0 } value
        ? value
        : throw new InvalidOperationException($"Missing configuration value: {key}");

    private static string BuildBody(OrderCreatedEvent order)
    {
        var items = string.Join(Environment.NewLine, order.Items.Select(item =>
            $"- {item.ProductName} x {item.Quantity} @ {item.UnitPriceDZD} DZD"));

        return $"New order #{order.OrderId}{Environment.NewLine}{Environment.NewLine}" +
            $"Customer: {order.CustomerFullName}{Environment.NewLine}" +
            $"Phone: {order.CustomerPhoneNumber}{Environment.NewLine}" +
            $"Address: {order.CustomerAdress}{Environment.NewLine}{Environment.NewLine}" +
            $"Items:{Environment.NewLine}{items}";
    }
}
