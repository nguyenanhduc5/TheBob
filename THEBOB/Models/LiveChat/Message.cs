using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using THEBOB.Models.Blog;

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

        /// <summary>Loại tin nhắn: Text (default), BlogPost, Product, Image.</summary>
        public MessageType MessageType { get; set; } = MessageType.Text;

        /// <summary>ID tham chiếu — BlogPostId khi MessageType=BlogPost.</summary>
        public int? ReferenceId { get; set; }

        /// <summary>
        /// JSON snapshot của nội dung tham chiếu tại thời điểm gửi.
        /// Ví dụ: {"title":"...","slug":"...","thumbnail":"...","summary":"..."}
        /// Đảm bảo lịch sử chat không vỡ nếu bài viết gốc bị sửa/xóa.
        /// </summary>
        [Column(TypeName = "longtext")]
        public string? Metadata { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public bool IsRead { get; set; }
    }
}
