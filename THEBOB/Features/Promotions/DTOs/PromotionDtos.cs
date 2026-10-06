using THEBOB.Models.Promotion;

namespace THEBOB.DTOs.Promotion
{
    // ─── Request DTOs ────────────────────────────────────────────────────────

    public class CreatePromotionRequest
    {
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string BannerUrl { get; set; } = string.Empty;
        public PromotionType Type { get; set; } = PromotionType.Automatic;
        public PromotionStatus Status { get; set; } = PromotionStatus.Draft;
        public int Priority { get; set; } = 20;
        public bool IsStackable { get; set; } = false;
        public int MaxStackCount { get; set; } = 0;
        public string ExclusiveGroup { get; set; } = string.Empty;
        public DiscountKind DiscountType { get; set; } = DiscountKind.Percentage;
        public decimal DiscountValue { get; set; }
        public decimal? MaxDiscountAmount { get; set; }
        public decimal MinOrderValue { get; set; } = 0;
        public decimal? MaxOrderValue { get; set; }
        public int MinQuantity { get; set; } = 0;
        public DateTime StartDate { get; set; } = DateTime.UtcNow;
        public DateTime EndDate { get; set; } = DateTime.UtcNow.AddMonths(1);
        public int UsageLimitTotal { get; set; } = 0;
        public int UsageLimitPerUser { get; set; } = 1;
        public int UsageLimitPerDay { get; set; } = 0;
        public int UsageLimitPerMonth { get; set; } = 0;
        public PromotionScope Scope { get; set; } = PromotionScope.AllShop;
        public string? CouponCode { get; set; }
        public bool IsPersonal { get; set; } = false;
        public bool RequiresNewUser { get; set; } = false;
        public bool RequiresCustomerGroup { get; set; } = false;
        public bool RequiresBirthdayUser { get; set; } = false;
        public int BuyQuantity { get; set; } = 0;
        public int GetQuantity { get; set; } = 0;
        public int? GetProductId { get; set; }
        public string CreatedBy { get; set; } = string.Empty;

        // Scope targets
        public List<int> ProductIds { get; set; } = new();
        public List<int> CategoryIds { get; set; } = new();
        public List<int> BrandIds { get; set; } = new();
        public List<int> CustomerGroupIds { get; set; } = new();

        // Exclude targets
        public List<int> ExcludedProductIds { get; set; } = new();
        public List<int> ExcludedCategoryIds { get; set; } = new();
        public List<int> ExcludedBrandIds { get; set; } = new();
    }

    public class UpdatePromotionStatusRequest
    {
        public PromotionStatus Status { get; set; }
    }

    public class ApplyCouponRequest
    {
        public string CouponCode { get; set; } = string.Empty;
    }

    public class CalculatePromotionsRequest
    {
        public string? CouponCode { get; set; }
        public int? UserCouponId { get; set; }
        public decimal? ShippingFee { get; set; }
    }

    public class SendUserCouponRequest
    {
        public int UserId { get; set; }
        public int PromotionId { get; set; }
        public DateTime? ExpiresAt { get; set; }
        public string Note { get; set; } = string.Empty;
    }

    public class SendBulkCouponRequest
    {
        public int PromotionId { get; set; }
        public List<int> UserIds { get; set; } = new();
        public DateTime? ExpiresAt { get; set; }
        public string Note { get; set; } = string.Empty;
    }

    // ─── Response DTOs ───────────────────────────────────────────────────────

    public class PromotionDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string BannerUrl { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public int Priority { get; set; }
        public bool IsStackable { get; set; }
        public int MaxStackCount { get; set; }
        public string ExclusiveGroup { get; set; } = string.Empty;
        public string DiscountType { get; set; } = string.Empty;
        public decimal DiscountValue { get; set; }
        public decimal? MaxDiscountAmount { get; set; }
        public decimal MinOrderValue { get; set; }
        public decimal? MaxOrderValue { get; set; }
        public int MinQuantity { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public int UsageLimitTotal { get; set; }
        public int UsageLimitPerUser { get; set; }
        public int UsageLimitPerDay { get; set; }
        public int UsageLimitPerMonth { get; set; }
        public int UsedCount { get; set; }
        public string Scope { get; set; } = string.Empty;
        public string? CouponCode { get; set; }
        public bool IsPersonal { get; set; }
        public bool RequiresNewUser { get; set; }
        public bool RequiresCustomerGroup { get; set; }
        public bool RequiresBirthdayUser { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public bool IsActive { get; set; }

        // Scope targets
        public List<int> ProductIds { get; set; } = new();
        public List<int> CategoryIds { get; set; } = new();
        public List<int> BrandIds { get; set; } = new();
        public List<int> CustomerGroupIds { get; set; } = new();
    }

    public class PromotionSummaryDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string DiscountType { get; set; } = string.Empty;
        public decimal DiscountValue { get; set; }
        public DateTime EndDate { get; set; }
        public int UsedCount { get; set; }
        public bool IsActive { get; set; }
    }

    public class CartPromotionDto
    {
        public decimal Subtotal { get; set; }
        public decimal ShippingFee { get; set; }
        public decimal AutomaticDiscount { get; set; }
        public decimal CouponDiscount { get; set; }
        public decimal ShippingDiscount { get; set; }
        public decimal TotalDiscount { get; set; }
        public decimal FinalShipping { get; set; }
        public decimal FinalAmount { get; set; }
        public string? AppliedCouponCode { get; set; }
        public List<AppliedPromotionDto> AppliedPromotions { get; set; } = new();
        public List<AvailablePromotionDto> AvailablePromotions { get; set; } = new();
    }

    public class AppliedPromotionDto
    {
        public int? PromotionId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string DiscountType { get; set; } = string.Empty;
        public decimal DiscountApplied { get; set; }
        public string Type { get; set; } = string.Empty;
    }

    public class AvailablePromotionDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string DiscountType { get; set; } = string.Empty;
        public decimal DiscountValue { get; set; }
        public DateTime EndDate { get; set; }
    }

    public class UserCouponDto
    {
        public int Id { get; set; }
        public int PromotionId { get; set; }
        public string PromotionName { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string DiscountType { get; set; } = string.Empty;
        public decimal DiscountValue { get; set; }
        public decimal? MaxDiscountAmount { get; set; }
        public decimal MinOrderValue { get; set; }
        public bool IsUsed { get; set; }
        public DateTime? UsedAt { get; set; }
        public DateTime? ExpiresAt { get; set; }
        public DateTime PromotionEndDate { get; set; }
        public bool IsExpired { get; set; }
        public string Note { get; set; } = string.Empty;
        public string? CouponCode { get; set; }
    }

    public class PromotionStatsDto
    {
        public int PromotionId { get; set; }
        public string Name { get; set; } = string.Empty;
        public int TotalUsages { get; set; }
        public decimal TotalDiscountGiven { get; set; }
        public int TotalOrders { get; set; }
        public decimal ConversionRate { get; set; }
    }

    public class PromotionStatsSummaryDto
    {
        public decimal TotalDiscountGiven { get; set; }
        public int TotalOrdersWithPromotion { get; set; }
        public List<PromotionStatsDto> TopPromotions { get; set; } = new();
    }

    public class ValidateCouponResponse
    {
        public bool IsValid { get; set; }
        public string? ErrorMessage { get; set; }
        public PromotionDto? Promotion { get; set; }
        public decimal EstimatedDiscount { get; set; }
    }
}
