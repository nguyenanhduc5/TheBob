using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace THEBOB.Models.Promotion
{
    /// <summary>
    /// Voucher cá nhân — Admin gửi cho User cụ thể.
    /// User thấy trong tài khoản → nhấn "Áp dụng" mà không cần nhập mã.
    /// </summary>
    public class UserCoupon
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int PromotionId { get; set; }

        [ForeignKey(nameof(PromotionId))]
        public Promotion Promotion { get; set; } = null!;

        [Required]
        public int UserId { get; set; }

        [ForeignKey(nameof(UserId))]
        public User User { get; set; } = null!;

        public bool IsUsed { get; set; } = false;

        public DateTime? UsedAt { get; set; }

        /// <summary>
        /// Ngày hết hạn riêng của voucher này (override EndDate của Promotion nếu có).
        /// </summary>
        public DateTime? ExpiresAt { get; set; }

        /// <summary>Ghi chú từ Admin khi gửi</summary>
        [MaxLength(500)]
        public string Note { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
