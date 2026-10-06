using Confluent.Kafka;

namespace THEBOB.Infrastructure.Messaging;

public sealed class KafkaOptions
{
    public const string SectionName = "Kafka";
    public string BootstrapServers { get; init; } = "localhost:9092";
    public SecurityProtocol SecurityProtocol { get; init; } = SecurityProtocol.Plaintext;
    public SaslMechanism SaslMechanism { get; init; } = SaslMechanism.ScramSha256;
    public string? SaslUsername { get; init; }
    public string? SaslPassword { get; init; }
    public string? SslCaPem { get; init; }
    public string OrderCreatedTopic { get; init; } = "thebob.order-created";
    public string AiChatRequestedTopic { get; init; } = "thebob.ai-chat-requested";
    public string BlogNotificationTopic { get; init; } = "thebob.blog-notification";
    public string BlogClickTopic { get; init; } = "thebob.blog-clicked";
    public string ConsumerGroupId { get; init; } = "thebob-order-workers";
    public int OutboxPollIntervalSeconds { get; init; } = 2;

    public void ConfigureClient(ClientConfig config)
    {
        config.BootstrapServers = BootstrapServers;
        config.SecurityProtocol = SecurityProtocol;

        var hasUsername = !string.IsNullOrWhiteSpace(SaslUsername);
        var hasPassword = !string.IsNullOrWhiteSpace(SaslPassword);
        var usesSasl = SecurityProtocol is SecurityProtocol.SaslSsl or SecurityProtocol.SaslPlaintext;

        if (hasUsername != hasPassword || usesSasl != hasUsername)
        {
            throw new InvalidOperationException(
                "Kafka SASL configuration requires both Kafka:SaslUsername and Kafka:SaslPassword with a SASL security protocol.");
        }

        if (hasUsername)
        {
            if (SecurityProtocol != SecurityProtocol.SaslSsl)
            {
                throw new InvalidOperationException("Kafka SASL credentials must be used with Kafka:SecurityProtocol=SaslSsl.");
            }

            config.SaslMechanism = SaslMechanism;
            config.SaslUsername = SaslUsername;
            config.SaslPassword = SaslPassword;
        }

        if (!string.IsNullOrWhiteSpace(SslCaPem))
        {
            config.SslCaPem = SslCaPem;
        }
    }
}
