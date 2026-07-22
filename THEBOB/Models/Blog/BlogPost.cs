using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace THEBOB.Models.Blog
{
    public class BlogPost
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(500)]
        public string Title { get; set; } = string.Empty;

        /// <summary>URL-friendly slug, unique, auto-generated from title.</summary>
        [Required]
        [MaxLength(600)]
        public string Slug { get; set; } = string.Empty;

        /// <summary>Rich-text HTML content. Contains [product:{id}] placeholders.</summary>
        [Column(TypeName = "longtext")]
        public string Content { get; set; } = string.Empty;

        [MaxLength(1000)]
        public string? Summary { get; set; }

        [MaxLength(2000)]
        public string? Thumbnail { get; set; }

        public int? CategoryId { get; set; }

        [ForeignKey(nameof(CategoryId))]
        public BlogCategory? Category { get; set; }

        [Required]
        public int AuthorId { get; set; }

        [ForeignKey(nameof(AuthorId))]
        public User Author { get; set; } = null!;

        public BlogStatus Status { get; set; } = BlogStatus.Draft;

        /// <summary>Hiển thị ở trang chủ khi true.</summary>
        public bool IsFeaturedHome { get; set; } = false;

        /// <summary>Thứ tự hiển thị trong section trang chủ (nhỏ hơn = ưu tiên hơn).</summary>
        public int HomeDisplayOrder { get; set; } = 0;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? PublishedAt { get; set; }

        // Navigation
        public ICollection<BlogPostProduct> BlogPostProducts { get; set; } = new List<BlogPostProduct>();
        public ICollection<BlogPostClick> Clicks { get; set; } = new List<BlogPostClick>();
    }
}
