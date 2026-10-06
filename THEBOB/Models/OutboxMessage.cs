using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace THEBOB.Models;

/// <summary>
/// An integration event written in the same database transaction as its business data.
/// Kafka publishing happens only after this row has committed.
/// </summary>
public class OutboxMessage
{
    [Key]
    public long Id { get; set; }

    [Required, MaxLength(100)]
    public string Type { get; set; } = string.Empty;

    [Required, MaxLength(200)]
    public string AggregateId { get; set; } = string.Empty;

    [Required, Column(TypeName = "longtext")]
    public string Payload { get; set; } = string.Empty;

    public DateTime OccurredAt { get; set; } = DateTime.UtcNow;
    public DateTime? PublishedAt { get; set; }
    public int AttemptCount { get; set; }

    [MaxLength(2000)]
    public string? LastError { get; set; }
}
