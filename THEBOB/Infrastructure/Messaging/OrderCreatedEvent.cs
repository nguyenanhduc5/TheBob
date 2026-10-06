namespace THEBOB.Infrastructure.Messaging;

public sealed record OrderCreatedEvent(
    int OrderId,
    string? RecipientName,
    string? RecipientPhone,
    string? SpecificAddress);
