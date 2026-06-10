using System.ComponentModel.DataAnnotations;

namespace THEBOB.Models
{
    public class AuditLog
    {
        [Key]
        public int Id { get; set; }

        public int? UserId { get; set; }

        public User? User { get; set; }

        [Required]
        [MaxLength(100)]
        public string Action { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string TableName { get; set; } = string.Empty;

        public string OldValues { get; set; } = string.Empty;

        public string NewValues { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
