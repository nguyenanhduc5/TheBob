using THEBOB.Infrastructure.Messaging;
using Microsoft.Extensions.Options;
using Confluent.Kafka;
using System.Text.Json;

namespace THEBOB.Services.Background
{
    /// <summary>
    /// Singleton queue ch?a các job Blog Click c?n ghi DB b?t d?ng b?.
    /// Dùng BoundedChannel(5000) v?i DropOldest — click analytics có th?
    /// ch?p nh?n m?t 1 s? record khi quá t?i, không block user.
    /// </summary>
    public class BlogClickProcessingQueue : IDisposable
    {
        private readonly KafkaJsonProducer _producer;
        private readonly KafkaOptions _options;
        private readonly IConsumer<string, string> _consumer;
        public BlogClickProcessingQueue(KafkaJsonProducer producer, IOptions<KafkaOptions> options) { _producer = producer; _options = options.Value; _consumer = new ConsumerBuilder<string,string>(new ConsumerConfig { BootstrapServers = _options.BootstrapServers, GroupId = "thebob-blog-click-workers", AutoOffsetReset = AutoOffsetReset.Earliest, EnableAutoCommit = true }).Build(); _consumer.Subscribe(_options.BlogClickTopic); }

        public ValueTask EnqueueAsync(BlogClickJob job) => new(_producer.PublishAsync(_options.BlogClickTopic, job.BlogPostId.ToString(), job));
        public async ValueTask<BlogClickJob> DequeueAsync(CancellationToken ct)
        {
            return await Task.Run(() =>
            {
                var result = _consumer.Consume(ct);
                return JsonSerializer.Deserialize<BlogClickJob>(result.Message.Value) ?? throw new InvalidOperationException("Invalid blog click Kafka message.");
            }, ct);
        }

        public void Dispose()
        {
            _consumer.Close();
            _consumer.Dispose();
        }
    }
}
