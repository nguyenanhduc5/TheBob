using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace THEBOB.Models.LiveChat
{
    public class Message
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int ConversationId { get; set; }

        [ForeignKey(nameof(ConversationId))]
        public Conversation Conversation { get; set; } = null!;

        public SenderType SenderType { get; set; }

        /// <summary>Null khi SenderType là AI hoặc System.</summary>
        public int? SenderId { get; set; }

        [ForeignKey(nameof(SenderId))]
        public User? Sender { get; set; }

        [Required]
        public string Content { get; set; } = string.Empty;

        public int? ReferencedProductId { get; set; }

        [ForeignKey(nameof(ReferencedProductId))]
        public Product? ReferencedProduct { get; set; }

        public int? ReferencedOrderId { get; set; }

        [ForeignKey(nameof(ReferencedOrderId))]
        public Order? ReferencedOrder { get; set; }

        [MaxLength(2000)]
        public string? ImageUrl { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public bool IsRead { get; set; }
    }
}
