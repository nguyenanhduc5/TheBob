using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace THEBOB.Models
{
    public class PaymentTransaction
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int OrderId { get; set; }

        public Order Order { get; set; } = null!;

        [Required]
        [MaxLength(50)]
        public string Gateway { get; set; } = string.Empty; // cod, qr

        [MaxLength(100)]
        public string TransactionCode { get; set; } = string.Empty;

        [MaxLength(100)]
        public string? VaNumber { get; set; }

        [MaxLength(100)]
        public string? TransactionId { get; set; }

        [MaxLength(50)]
        public string PaymentProvider { get; set; } = string.Empty;

        [Required]
        [Column(TypeName = "decimal(12,2)")]
        public decimal Amount { get; set; }

        [Required]
        [MaxLength(50)]
        public string Status { get; set; } = "Pending"; // Pending, Paid, Failed, Expired

        public DateTime? PaidAt { get; set; }

        [MaxLength(500)]
        public string? FailureReason { get; set; }

        public string RawResponse { get; set; } = string.Empty;

        public string? WebhookPayload { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
