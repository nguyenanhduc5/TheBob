using System.ComponentModel.DataAnnotations;

namespace THEBOB.DTOs.AdminProducts
{
    public class AdminProductCreateRequest
    {
        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        [Required]
        [MaxLength(1000)]
        public string Description { get; set; } = string.Empty;

        public int? BrandId { get; set; }

        [MaxLength(100)]
        public string? BrandName { get; set; }

        public int? CategoryId { get; set; }

        [MaxLength(100)]
        public string Material { get; set; } = string.Empty;

        [MaxLength(100)]
        public string CareInstructions { get; set; } = string.Empty;

        public bool IsFeatured { get; set; }

        public List<string> ImageUrls { get; set; } = new();

        [MinLength(1)]
        public List<AdminVariantCreateRequest> Variants { get; set; } = new();
    }

    public class AdminProductUpdateRequest
    {
        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        [Required]
        [MaxLength(1000)]
        public string Description { get; set; } = string.Empty;

        public int? BrandId { get; set; }

        [MaxLength(100)]
        public string? BrandName { get; set; }

        public int? CategoryId { get; set; }

        [MaxLength(100)]
        public string Material { get; set; } = string.Empty;

        [MaxLength(100)]
        public string CareInstructions { get; set; } = string.Empty;

        public bool IsFeatured { get; set; }

        public bool IsAvailable { get; set; } = true;

        public List<string>? ImageUrls { get; set; }

        public List<AdminVariantUpsertRequest> Variants { get; set; } = new();
    }

    public class AdminVariantCreateRequest
    {
        public int? ColorId { get; set; }
        public string? ColorName { get; set; }
        public string? HexCode { get; set; }

        public int? SizeId { get; set; }
        public string? SizeName { get; set; }

        [Range(0.01, 9999999.99)]
        public decimal Price { get; set; }

        [Range(0, int.MaxValue)]
        public int Stock { get; set; }

        public List<string> ImageUrls { get; set; } = new();
    }

    public class AdminVariantUpsertRequest : AdminVariantCreateRequest
    {
        public int? Id { get; set; }
        public bool IsAvailable { get; set; } = true;
    }

    public class AdminProductStatusRequest
    {
        public bool IsAvailable { get; set; }
    }

    public class AdminVariantStockRequest
    {
        [Range(0, int.MaxValue)]
        public int Stock { get; set; }

        [MaxLength(500)]
        public string Reason { get; set; } = "Admin stock adjustment";
    }

    public class AdminVariantPriceRequest
    {
        [Range(0.01, 9999999.99)]
        public decimal Price { get; set; }
    }

    public class AdminProductListItemDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Brand { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public decimal MinPrice { get; set; }
        public int TotalStock { get; set; }
        public bool IsFeatured { get; set; }
        public bool IsAvailable { get; set; }
        public bool IsDeleted { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }

    public class AdminProductDetailDto : AdminProductListItemDto
    {
        public string Description { get; set; } = string.Empty;
        public int? BrandId { get; set; }
        public int? CategoryId { get; set; }
        public string Material { get; set; } = string.Empty;
        public string CareInstructions { get; set; } = string.Empty;
        public DateTime? DeletedAt { get; set; }
        public List<ProductImageDto> Images { get; set; } = new();
        public List<AdminVariantDto> Variants { get; set; } = new();
    }

    public class ProductImageDto
    {
        public int Id { get; set; }
        public string Url { get; set; } = string.Empty;
        public int SortOrder { get; set; }
    }

    public class AdminVariantDto
    {
        public int Id { get; set; }
        public int ColorId { get; set; }
        public string Color { get; set; } = string.Empty;
        public string HexCode { get; set; } = string.Empty;
        public int SizeId { get; set; }
        public string Size { get; set; } = string.Empty;
        public decimal Price { get; set; }
        public int Stock { get; set; }
        public string Sku { get; set; } = string.Empty;
        public bool IsAvailable { get; set; }
        public bool IsDeleted { get; set; }
        public List<ProductImageDto> Images { get; set; } = new();
    }
}
