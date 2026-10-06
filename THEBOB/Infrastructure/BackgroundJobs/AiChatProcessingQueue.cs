using THEBOB.Infrastructure.Messaging;
using Microsoft.Extensions.Options;
using Confluent.Kafka;
using Confluent.Kafka.Admin;
using System.Text.Json;
namespace THEBOB.Services.Background
{
    /// <summary>
    /// Singleton queue ch?a các job AI Chat c?n x? lý b?t d?ng b?.
    /// Dùng BoundedChannel(1000) v?i SingleReader d? d?m b?o th? t? x? lý
    /// và tránh tràn b? nh? khi traffic d?t bi?n.
    /// </summary>
    public class AiChatProcessingQueue : IDisposable
    {
        private readonly KafkaJsonProducer _producer;
        private readonly KafkaOptions _options;
        private readonly IConsumer<string, string> _consumer;
        public AiChatProcessingQueue(KafkaJsonProducer producer, IOptions<KafkaOptions> options) {
        _producer = producer;
        _options = options.Value;
        // Ensure the AI chat request topic exists
        try {
            var adminConfig = new AdminClientConfig();
            _options.ConfigureClient(adminConfig);
            using var adminClient = new AdminClientBuilder(adminConfig).Build();
            var topicSpec = new TopicSpecification { Name = _options.AiChatRequestedTopic, NumPartitions = 1, ReplicationFactor = 1 };
            adminClient.CreateTopicsAsync(new[] { topicSpec }).GetAwaiter().GetResult();
        } catch (Exception) {
            // Ignore if topic already exists or Kafka topic provisioner handles it
        }
        var consumerConfig = new ConsumerConfig { GroupId = "thebob-ai-chat-workers", AutoOffsetReset = AutoOffsetReset.Earliest, EnableAutoCommit = true, AllowAutoCreateTopics = true };
        _options.ConfigureClient(consumerConfig);
        _consumer = new ConsumerBuilder<string, string>(consumerConfig).Build();
        _consumer.Subscribe(_options.AiChatRequestedTopic);
    }

        public ValueTask EnqueueAsync(AiChatJob job) => new(_producer.PublishAsync(_options.AiChatRequestedTopic, job.ConversationId.ToString(), job));
        public async ValueTask<AiChatJob> DequeueAsync(CancellationToken ct)
        {
            return await Task.Run(() =>
            {
                var result = _consumer.Consume(ct);
                return JsonSerializer.Deserialize<AiChatJob>(result.Message.Value) ?? throw new InvalidOperationException("Invalid AI chat Kafka message.");
            }, ct);
        }

        public void Dispose()
        {
            _consumer.Close();
            _consumer.Dispose();
        }
    }
}
