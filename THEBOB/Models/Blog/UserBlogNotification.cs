using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace THEBOB.Models.Blog
{
    /// <summary>
    /// Trạng thái đọc thông báo blog cho từng user (1 record per user per notification).
    /// </summary>
    public class UserBlogNotification
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int BlogNotificationId { get; set; }

        [ForeignKey(nameof(BlogNotificationId))]
        public BlogNotification BlogNotification { get; set; } = null!;

        [Required]
        public int UserId { get; set; }

        [ForeignKey(nameof(UserId))]
        public User User { get; set; } = null!;

        public bool IsRead { get; set; } = false;

        public DateTime SentAt { get; set; } = DateTime.UtcNow;

        public DateTime? ReadAt { get; set; }
    }
}
