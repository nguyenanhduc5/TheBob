using System.ComponentModel.DataAnnotations;

namespace THEBOB.Models
{
    public class Color
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(20)]
        public string HexCode { get; set; } = string.Empty;

        public ICollection<ProductVariant> ProductVariants { get; set; } = new List<ProductVariant>();
    }
}
