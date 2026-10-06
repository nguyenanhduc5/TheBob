using Confluent.Kafka;
using Confluent.Kafka.Admin;
using Microsoft.Extensions.Options;

namespace THEBOB.Infrastructure.Messaging;

public sealed class KafkaTopicProvisioner : IHostedService
{
    private readonly KafkaOptions _options;
    private readonly ILogger<KafkaTopicProvisioner> _logger;

    public KafkaTopicProvisioner(IOptions<KafkaOptions> options, ILogger<KafkaTopicProvisioner> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        var topics = new[]
        {
            _options.OrderCreatedTopic,
            _options.AiChatRequestedTopic,
            _options.BlogNotificationTopic,
            _options.BlogClickTopic
        }
        .Where(topic => !string.IsNullOrWhiteSpace(topic))
        .Distinct(StringComparer.Ordinal)
        .Select(topic => new TopicSpecification
        {
            Name = topic,
            NumPartitions = 1,
            ReplicationFactor = 1
        })
        .ToList();

        using var adminClient = new AdminClientBuilder(new AdminClientConfig
        {
            BootstrapServers = _options.BootstrapServers
        }).Build();

        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                await adminClient.CreateTopicsAsync(topics, new CreateTopicsOptions
                {
                    RequestTimeout = TimeSpan.FromSeconds(10)
                });

                _logger.LogInformation("Kafka topics are ready: {Topics}", string.Join(", ", topics.Select(topic => topic.Name)));
                return;
            }
            catch (CreateTopicsException exception) when (exception.Results.All(result => result.Error.Code == ErrorCode.TopicAlreadyExists))
            {
                _logger.LogInformation("Kafka topics already exist: {Topics}", string.Join(", ", topics.Select(topic => topic.Name)));
                return;
            }
            catch (KafkaException exception) when (!cancellationToken.IsCancellationRequested)
            {
                _logger.LogWarning(exception, "Kafka is not ready at {BootstrapServers}; retrying topic provisioning.", _options.BootstrapServers);
                await Task.Delay(TimeSpan.FromSeconds(2), cancellationToken);
            }
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
