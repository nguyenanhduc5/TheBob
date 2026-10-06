using Confluent.Kafka;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using THEBOB.Data;
using THEBOB.Models;

namespace THEBOB.Infrastructure.Messaging;

/// <summary>Publishes committed outbox rows. Kafka delivery is at-least-once; consumers must be idempotent.</summary>
public sealed class OutboxPublisherService : BackgroundService
{
    private const string OrderCreated = "OrderCreated";
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly KafkaOptions _options;
    private readonly ILogger<OutboxPublisherService> _logger;
    private readonly IProducer<string, string> _producer;

    public OutboxPublisherService(IServiceScopeFactory scopeFactory, IOptions<KafkaOptions> options, ILogger<OutboxPublisherService> logger)
    {
        _scopeFactory = scopeFactory;
        _options = options.Value;
        _logger = logger;
        _producer = new ProducerBuilder<string, string>(new ProducerConfig
        {
            BootstrapServers = _options.BootstrapServers,
            EnableIdempotence = true,
            Acks = Acks.All
        }).Build();
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Yield();
        var busyInterval = TimeSpan.FromSeconds(Math.Max(1, _options.OutboxPollIntervalSeconds));
        var idleInterval = TimeSpan.FromSeconds(10);
        var maxIdleInterval = TimeSpan.FromSeconds(30);
        var delay = busyInterval;

        while (!stoppingToken.IsCancellationRequested)
        {
            var published = 0;
            try { published = await PublishBatchAsync(stoppingToken); }
            catch (Exception ex) { _logger.LogError(ex, "Kafka outbox publishing failed."); }

            if (published == 0)
            {
                delay = delay < idleInterval
                    ? idleInterval
                    : TimeSpan.FromSeconds(Math.Min(maxIdleInterval.TotalSeconds, delay.TotalSeconds * 2));
            }
            else
            {
                delay = busyInterval;
            }

            await Task.Delay(delay, stoppingToken);
        }
    }

    private async Task<int> PublishBatchAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ThebobDbContext>();
        var messages = await db.OutboxMessages
            .Where(x => x.PublishedAt == null)
            .OrderBy(x => x.OccurredAt).ThenBy(x => x.Id)
            .Take(50).ToListAsync(ct);

        foreach (var message in messages)
        {
            try
            {
                var topic = message.Type switch { OrderCreated => _options.OrderCreatedTopic, _ => throw new InvalidOperationException($"Unsupported outbox event '{message.Type}'.") };
                await _producer.ProduceAsync(topic, new Message<string, string> { Key = message.AggregateId, Value = message.Payload }, ct);
                message.PublishedAt = DateTime.UtcNow;
                message.AttemptCount++;
                message.LastError = null;
            }
            catch (Exception ex)
            {
                message.AttemptCount++;
                message.LastError = ex.Message[..Math.Min(ex.Message.Length, 2000)];
                _logger.LogWarning(ex, "Could not publish outbox message {OutboxId}.", message.Id);
            }
        }
        if (messages.Count > 0) await db.SaveChangesAsync(ct);
        return messages.Count;
    }

    public override void Dispose()
    {
        _producer.Flush(TimeSpan.FromSeconds(5));
        _producer.Dispose();
        base.Dispose();
    }
}
