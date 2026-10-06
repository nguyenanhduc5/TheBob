using System.Text.Json;
using Confluent.Kafka;
using Microsoft.Extensions.Options;
using THEBOB.Infrastructure.Messaging;
using THEBOB.Services.Blog;

namespace THEBOB.Services.Background;

public sealed class BlogNotificationKafkaQueue : IDisposable
{
    private readonly KafkaJsonProducer _producer; private readonly KafkaOptions _options; private readonly IConsumer<string,string> _consumer;
    public BlogNotificationKafkaQueue(KafkaJsonProducer producer, IOptions<KafkaOptions> options) { _producer = producer; _options = options.Value; _consumer = new ConsumerBuilder<string,string>(new ConsumerConfig { BootstrapServers = _options.BootstrapServers, GroupId = "thebob-blog-notification-workers", AutoOffsetReset = AutoOffsetReset.Earliest, EnableAutoCommit = true }).Build(); _consumer.Subscribe(_options.BlogNotificationTopic); }
    public ValueTask EnqueueAsync(BlogNotificationJob job) => new(_producer.PublishAsync(_options.BlogNotificationTopic, job.NotificationId.ToString(), job));
    public async ValueTask<BlogNotificationJob> DequeueAsync(CancellationToken ct)
    {
        return await Task.Run(() =>
        {
            var result = _consumer.Consume(ct);
            return JsonSerializer.Deserialize<BlogNotificationJob>(result.Message.Value) ?? throw new InvalidOperationException("Invalid blog notification Kafka message.");
        }, ct);
    }
    public void Dispose() { _consumer.Close(); _consumer.Dispose(); }
}
