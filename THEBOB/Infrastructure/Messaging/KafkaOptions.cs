namespace THEBOB.Infrastructure.Messaging;

public sealed class KafkaOptions
{
    public const string SectionName = "Kafka";
    public string BootstrapServers { get; init; } = "localhost:9092";
    public string OrderCreatedTopic { get; init; } = "thebob.order-created";
    public string AiChatRequestedTopic { get; init; } = "thebob.ai-chat-requested";
    public string BlogNotificationTopic { get; init; } = "thebob.blog-notification";
    public string BlogClickTopic { get; init; } = "thebob.blog-clicked";
    public string ConsumerGroupId { get; init; } = "thebob-order-workers";
    public int OutboxPollIntervalSeconds { get; init; } = 2;
}
