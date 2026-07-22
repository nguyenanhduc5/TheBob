using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace THEBOB.Models.Blog
{
    /// <summary>
    /// Nội dung gốc của một lần broadcast thông báo blog (1 record cho toàn bộ lần gửi).
    /// Tách riêng khỏi UserBlogNotification để tránh nhân bản content.
    /// </summary>
    public class BlogNotification
    {
        [Key]
        public int Id { get; set; }

        /// <summary>Bài viết liên quan (nullable — admin có thể gửi thông báo không gắn bài cụ thể).</summary>
        public int? BlogPostId { get; set; }

        [ForeignKey(nameof(BlogPostId))]
        public BlogPost? BlogPost { get; set; }

        [Required]
        [MaxLength(500)]
        public string Title { get; set; } = string.Empty;

        [MaxLength(2000)]
        public string? Body { get; set; }

        public BlogNotificationTargetType TargetType { get; set; } = BlogNotificationTargetType.All;

        /// <summary>Segment JSON (dùng cho TargetType=Segment): {"minOrders":3,"tier":"VIP"} v.v.</summary>
        [MaxLength(1000)]
        public string? SegmentConfig { get; set; }

        [Required]
        public int CreatedByAdminId { get; set; }

        [ForeignKey(nameof(CreatedByAdminId))]
        public User CreatedByAdmin { get; set; } = null!;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public ICollection<UserBlogNotification> UserBlogNotifications { get; set; } = new List<UserBlogNotification>();
    }
}
