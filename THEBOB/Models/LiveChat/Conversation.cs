using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace THEBOB.Models.LiveChat
{
    public class Conversation
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int UserId { get; set; }

        [ForeignKey(nameof(UserId))]
        public User User { get; set; } = null!;

        public int? AssignedAdminId { get; set; }

        [ForeignKey(nameof(AssignedAdminId))]
        public User? AssignedAdmin { get; set; }

        public int? CurrentProductId { get; set; }

        [ForeignKey(nameof(CurrentProductId))]
        public Product? CurrentProduct { get; set; }

        public int? CurrentVariantId { get; set; }

        [ForeignKey(nameof(CurrentVariantId))]
        public ProductVariant? CurrentVariant { get; set; }

        public int? CurrentOrderId { get; set; }

        [ForeignKey(nameof(CurrentOrderId))]
        public Order? CurrentOrder { get; set; }

        public ChatMode ChatMode { get; set; } = ChatMode.AI;

        public ConversationStatus Status { get; set; } = ConversationStatus.Open;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public ICollection<Message> Messages { get; set; } = new List<Message>();
    }
}
