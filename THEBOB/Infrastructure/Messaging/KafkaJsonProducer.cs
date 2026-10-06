using System.Text.Json;
using Confluent.Kafka;
using Microsoft.Extensions.Options;
namespace THEBOB.Infrastructure.Messaging;
public sealed class KafkaJsonProducer : IDisposable
{
    private readonly IProducer<string,string> _producer;
    public KafkaJsonProducer(IOptions<KafkaOptions> options)
    {
        var kafkaOptions = options.Value;
        var config = new ProducerConfig { EnableIdempotence = true, Acks = Acks.All };
        kafkaOptions.ConfigureClient(config);
        _producer = new ProducerBuilder<string, string>(config).Build();
    }

    public Task PublishAsync<T>(string topic, string key, T data, CancellationToken ct = default) => _producer.ProduceAsync(topic, new Message<string,string> { Key = key, Value = JsonSerializer.Serialize(data) }, ct);
    public void Dispose() { _producer.Flush(TimeSpan.FromSeconds(5)); _producer.Dispose(); }
}
