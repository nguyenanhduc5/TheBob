using System.Text.Json;
using Confluent.Kafka;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using THEBOB.Data;
using THEBOB.Hubs;
using THEBOB.Models;
using THEBOB.Services;

namespace THEBOB.Infrastructure.Messaging;

/// <summary>Consumes order-created events and performs slow side effects after the order is durable.</summary>
public sealed class OrderCreatedConsumerService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly KafkaOptions _options;
    private readonly ILogger<OrderCreatedConsumerService> _logger;

    public OrderCreatedConsumerService(IServiceScopeFactory scopeFactory, IOptions<KafkaOptions> options, ILogger<OrderCreatedConsumerService> logger)
    { _scopeFactory = scopeFactory; _options = options.Value; _logger = logger; }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Yield();
        var config = new ConsumerConfig { BootstrapServers = _options.BootstrapServers, GroupId = _options.ConsumerGroupId, AutoOffsetReset = AutoOffsetReset.Earliest, EnableAutoCommit = false };
        using var consumer = new ConsumerBuilder<string, string>(config).Build();
        consumer.Subscribe(_options.OrderCreatedTopic);
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var result = await Task.Run(() => consumer.Consume(stoppingToken), stoppingToken);
                var message = JsonSerializer.Deserialize<OrderCreatedEvent>(result.Message.Value) ?? throw new InvalidOperationException("Invalid order-created event.");
                await ProcessAsync(message, stoppingToken);
                consumer.Commit(result);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex) { _logger.LogError(ex, "Order-created Kafka message processing failed; it will be retried."); await Task.Delay(TimeSpan.FromSeconds(2), stoppingToken); }
        }
        consumer.Close();
    }

    private async Task ProcessAsync(OrderCreatedEvent message, CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ThebobDbContext>();
        var ghn = scope.ServiceProvider.GetRequiredService<IGhnService>();
        var hub = scope.ServiceProvider.GetRequiredService<IHubContext<OrderHub>>();
        var order = await db.Orders.Include(x => x.OrderItems).Include(x => x.User).FirstOrDefaultAsync(x => x.Id == message.OrderId, ct)
            ?? throw new InvalidOperationException($"Order {message.OrderId} no longer exists.");

        // Idempotency for at-least-once Kafka delivery: never create a second GHN shipment.
        if (order.PaymentMethod.Equals("cod", StringComparison.OrdinalIgnoreCase) &&
            string.IsNullOrWhiteSpace(order.GhnOrderCode) && order.GhnDistrictId.HasValue && !string.IsNullOrWhiteSpace(order.GhnWardCode))
        {
            var shipment = await ghn.CreateShippingOrderAsync(GhnOrderRequestBuilder.FromOrder(
                order,
                order.OrderItems,
                message.RecipientName,
                message.RecipientPhone,
                message.SpecificAddress));
            order.GhnOrderCode = shipment.OrderCode;
            order.ShippingStatus = "ready_to_pick";
            order.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
        }

        await hub.Clients.Group("Admins").SendAsync("ReceiveNewOrder", new { orderId = order.Id, orderNumber = order.OrderNumber, totalAmount = order.TotalAmount, paymentMethod = order.PaymentMethod, createdAt = order.CreatedAt }, ct);
    }
}
