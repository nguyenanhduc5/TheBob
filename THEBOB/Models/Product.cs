using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace THEBOB.Models
{
    public class Product
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string Sku { get; set; } = string.Empty;

        [MaxLength(1000)]
        public string Description { get; set; } = string.Empty;

        [MaxLength(100)]
        public string Brand { get; set; } = string.Empty;

        [MaxLength(100)]
        public string Material { get; set; } = string.Empty;

        [MaxLength(100)]
        public string Color { get; set; } = string.Empty;

        [MaxLength(100)]
        public string CareInstructions { get; set; } = string.Empty;

        [Required]
        public decimal Price { get; set; }

        [Range(0, 99999)]
        public int Stock { get; set; }

        [MaxLength(500)]
        public string MainImageUrl { get; set; } = string.Empty;

        public bool IsFeatured { get; set; } = false;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        [Range(0, 5)]
        public double Rating { get; set; } = 0;

        [Range(0, 99999)]
        public int ReviewCount { get; set; } = 0;

        // Category relationship
        public int? CategoryId { get; set; }

        [ForeignKey("CategoryId")]
        public Category? Category { get; set; }

        // Product images and sizes
        public ICollection<ProductImage> Images { get; set; } = new List<ProductImage>();
        public ICollection<ProductSize> Sizes { get; set; } = new List<ProductSize>();
    }
}
