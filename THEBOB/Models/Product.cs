using System.ComponentModel.DataAnnotations;

namespace THEBOB.Models
{
    public class Product
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(1000)]
        public string Description { get; set; } = string.Empty;

        [MaxLength(100)]
        public string Category { get; set; } = string.Empty;

        [MaxLength(50)]
        public string Size { get; set; } = string.Empty;

        [MaxLength(50)]
        public string Color { get; set; } = string.Empty;

        [Range(0, 99999.99)]
        public decimal Price { get; set; }

        [Range(0, 99999)]
        public int Stock { get; set; }

        [MaxLength(500)]
        public string ImageUrl { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        [Range(0, 5)]
        public double Rating { get; set; } = 0;

        [Range(0, 99999)]
        public int ReviewCount { get; set; } = 0;
    }
}
