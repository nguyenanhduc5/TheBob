using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace THEBOB.Models.Blog
{
    /// <summary>
    /// Bảng trung gian M-N giữa BlogPost và Product.
    /// DisplayOrder dùng để sắp xếp sản phẩm liên quan.
    /// </summary>
    public class BlogPostProduct
    {
        [Required]
        public int BlogPostId { get; set; }

        [ForeignKey(nameof(BlogPostId))]
        public BlogPost BlogPost { get; set; } = null!;

        [Required]
        public int ProductId { get; set; }

        [ForeignKey(nameof(ProductId))]
        public Product Product { get; set; } = null!;

        public int DisplayOrder { get; set; } = 0;
    }
}
