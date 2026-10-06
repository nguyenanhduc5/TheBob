using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace THEBOB.Models
{
    [Table("IdempotentRequests")]
    public class IdempotentRequest
    {
        [Key]
        public long Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string Key { get; set; } = string.Empty;

        public int? UserId { get; set; }

        [Required]
        [MaxLength(200)]
        public string Path { get; set; } = string.Empty;

        [Required]
        [MaxLength(10)]
        public string Method { get; set; } = string.Empty;

        [MaxLength(64)]
        public string? RequestHash { get; set; }

        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "InFlight"; // InFlight, Completed, Failed

        public int? StatusCode { get; set; }

        [Column(TypeName = "longtext")]
        public string? ResponseBody { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public DateTime ExpiresAt { get; set; } = DateTime.UtcNow.AddHours(24);
    }
}
