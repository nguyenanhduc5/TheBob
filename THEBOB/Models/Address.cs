using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System;

namespace THEBOB.Models
{
    public class Address
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int UserId { get; set; }

        [ForeignKey("UserId")]
        public User User { get; set; } = null!;

        [Required]
        [MaxLength(255)]
        public string RecipientName { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string RecipientPhone { get; set; } = string.Empty;

        [Required]
        [MaxLength(255)]
        public string ProvinceCity { get; set; } = string.Empty;

        [Required]
        [MaxLength(255)]
        public string District { get; set; } = string.Empty;

        [Required]
        [MaxLength(255)]
        public string Ward { get; set; } = string.Empty;

        [Required]
        [MaxLength(500)]
        public string SpecificAddress { get; set; } = string.Empty;

        public bool IsDefault { get; set; } = false;
        // ── GHN (Giao Hàng Nhanh) location codes — cần để tính phí ship & tạo đơn ──
public int? GhnProvinceId { get; set; }
public int? GhnDistrictId { get; set; }
[MaxLength(50)]
public string? GhnWardCode { get; set; }

public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
        
    }
}
