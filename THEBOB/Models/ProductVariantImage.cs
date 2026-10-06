using System.ComponentModel.DataAnnotations;

namespace THEBOB.Models
{
    public class ProductVariantImage
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int VariantId { get; set; }

        public ProductVariant Variant { get; set; } = null!;

        [Required]
        [MaxLength(2000)]
        public string Url { get; set; } = string.Empty;

        public int SortOrder { get; set; } = 0;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
