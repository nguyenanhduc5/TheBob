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

        [MaxLength(2000)]
        public string MainImageUrl { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        [Range(0, 5)]
        public double Rating { get; set; } = 0;

        [Range(0, 99999)]
        public int ReviewCount { get; set; } = 0;

        public int? BrandId { get; set; }

        public Brand? Brand { get; set; }

        [MaxLength(100)]
        public string CareInstructions { get; set; } = string.Empty;

        public int? CategoryId { get; set; }

        public Category? Category { get; set; }

        public bool IsFeatured { get; set; } = false;

        public bool IsAvailable { get; set; } = true;

        [MaxLength(100)]
        public string Material { get; set; } = string.Empty;

        public bool IsDeleted { get; set; } = false;

        public DateTime? DeletedAt { get; set; }

        public ICollection<ProductVariant> ProductVariants { get; set; } = new List<ProductVariant>();

        public ICollection<ProductImage> Images { get; set; } = new List<ProductImage>();
    }
}
