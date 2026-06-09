using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System;
using System.Collections.Generic;

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

        [Required]
        [MaxLength(100)]
        public string Sku { get; set; } = string.Empty;

        [MaxLength(500)]
        public string MainImageUrl { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        [Range(0, 5)]
        public double Rating { get; set; } = 0;

        [Range(0, 99999)]
        public int ReviewCount { get; set; } = 0;

        [MaxLength(100)]
        public string Brand { get; set; } = string.Empty;

        [MaxLength(100)]
        public string CareInstructions { get; set; } = string.Empty;

        public int? CategoryId { get; set; }

        [ForeignKey("CategoryId")]
        public Category? Category { get; set; }

        public bool IsFeatured { get; set; } = false;

        [MaxLength(100)]
        public string Material { get; set; } = string.Empty;

        // KẾT NỐI CHUẨN ĐẾN BẢNG PRODUCT VARIANTS THEO SƠ ĐỒ
        public ICollection<ProductVariant> ProductVariants { get; set; } = new List<ProductVariant>();

        public ICollection<ProductImage> Images { get; set; } = new List<ProductImage>();

        // KÍCH HOẠT BẢNG KÍCH THƯỚC SẢN PHẨM (ĐƯỢC DÙNG BỞI FRONTEND)
        public ICollection<ProductSize> Sizes { get; set; } = new List<ProductSize>();
    }
}