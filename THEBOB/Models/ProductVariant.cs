using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace THEBOB.Models
{
    public class ProductVariant
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int ProductId { get; set; }

        [JsonIgnore]
        public Product? Product { get; set; }

        [Required]
        public int SizeId { get; set; }

        public Size? Size { get; set; }

        [Required]
        public int ColorId { get; set; }

        public Color? Color { get; set; }

        [Required]
        [Column(TypeName = "decimal(12,2)")]
        [Range(0, 9999999.99)]
        public decimal Price { get; set; }

        [Required]
        [Range(0, int.MaxValue)]
        public int Stock { get; set; }

        [Required]
        [MaxLength(100)]
        public string Sku { get; set; } = string.Empty;

        public bool IsAvailable { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public bool IsDeleted { get; set; } = false;

        public DateTime? DeletedAt { get; set; }

        public ICollection<ProductVariantImage> Images { get; set; } = new List<ProductVariantImage>();
    }
}
