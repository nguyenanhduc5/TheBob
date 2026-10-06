using System.ComponentModel.DataAnnotations;

namespace THEBOB.Models
{
    public class RecommendationLog
    {
        [Key]
        public int Id { get; set; }

        public int? UserId { get; set; }

        [Required]
        public int ProductId { get; set; }

        [Required]
        [MaxLength(50)]
        public string RecommendationType { get; set; } = string.Empty;

        public bool Clicked { get; set; } = false;

        public bool Purchased { get; set; } = false;

        public DateTime ActionAt { get; set; } = DateTime.UtcNow;
    }
}
