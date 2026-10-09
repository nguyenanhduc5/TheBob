using System.ComponentModel.DataAnnotations;

namespace THEBOB.Models
{
    public class Collection
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(160)]
        public string Name { get; set; } = string.Empty;

        [Required]
        [MaxLength(180)]
        public string Slug { get; set; } = string.Empty;

        [MaxLength(200)]
        public string Subtitle { get; set; } = string.Empty;

        [MaxLength(1200)]
        public string Description { get; set; } = string.Empty;

        [MaxLength(2000)]
        public string ImageUrl { get; set; } = string.Empty;

        public bool IsActive { get; set; } = true;

        public int SortOrder { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public bool IsDeleted { get; set; }

        public DateTime? DeletedAt { get; set; }

        public ICollection<ProductCollection> ProductCollections { get; set; } = new List<ProductCollection>();
    }

}
