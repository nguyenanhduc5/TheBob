using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace THEBOB.Models.Blog
{
    /// <summary>
    /// Theo dõi click vào ProductCard trong bài viết hoặc bài viết trong notification/chat.
    /// Fire-and-forget, dùng để phân tích kênh conversion.
    /// </summary>
    public class BlogPostClick
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int BlogPostId { get; set; }

        [ForeignKey(nameof(BlogPostId))]
        public BlogPost BlogPost { get; set; } = null!;

        /// <summary>Null nếu user chưa đăng nhập.</summary>
        public int? UserId { get; set; }

        [ForeignKey(nameof(UserId))]
        public User? User { get; set; }

        [MaxLength(100)]
        public string? SessionId { get; set; }

        /// <summary>Nguồn click: Home, Notification, Chat, Direct.</summary>
        public BlogClickSource Source { get; set; } = BlogClickSource.Direct;

        /// <summary>ProductId nếu click vào ProductCard bên trong bài viết.</summary>
        public int? ProductId { get; set; }

        public DateTime ClickedAt { get; set; } = DateTime.UtcNow;
    }
}
