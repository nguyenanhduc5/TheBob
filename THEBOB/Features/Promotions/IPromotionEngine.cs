using THEBOB.Models.Promotion;

namespace THEBOB.Services.Promotion
{
    /// <summary>
    /// Interface của Promotion Engine — orchestrator chính.
    /// Inject vào CartController, OrdersController, CheckoutController.
    /// </summary>
    public interface IPromotionEngine
    {
        /// <summary>
        /// Tính toán tất cả discount hợp lệ cho context hiện tại.
        /// Backend là nơi duy nhất tính giá — không tin frontend.
        /// </summary>
        Task<PromotionResult> CalculateAsync(PromotionContext context, CancellationToken ct = default);

        /// <summary>
        /// Xác thực coupon code có hợp lệ không (không áp dụng, chỉ validate).
        /// </summary>
        Task<(bool IsValid, string? ErrorMessage, Models.Promotion.Promotion? Promotion)>
            ValidateCouponAsync(string couponCode, PromotionContext context, CancellationToken ct = default);

        /// <summary>
        /// Lấy danh sách promotions đang active mà user có thể thấy (để hiển thị ở cart).
        /// </summary>
        Task<List<Models.Promotion.Promotion>> GetApplicablePromotionsAsync(
            PromotionContext context, CancellationToken ct = default);

        /// <summary>
        /// Commit sử dụng — lưu PromotionUsage + tăng UsedCount.
        /// Gọi sau khi Order đã được tạo thành công (trong transaction).
        /// </summary>
        Task CommitUsageAsync(int orderId, int userId, PromotionResult result, CancellationToken ct = default);

        /// <summary>
        /// Rollback sử dụng khi Order bị hủy.
        /// Giảm UsedCount, đánh dấu PromotionUsage.IsRolledBack.
        /// </summary>
        Task RollbackUsageAsync(int orderId, CancellationToken ct = default);
    }
}
