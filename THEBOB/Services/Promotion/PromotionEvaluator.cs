using THEBOB.Data;
using THEBOB.Models.Promotion;
using Microsoft.EntityFrameworkCore;

namespace THEBOB.Services.Promotion
{
    /// <summary>
    /// Kiểm tra tất cả điều kiện của một Promotion với một PromotionContext.
    /// Tách riêng để dễ unit test và extend.
    /// </summary>
    public class PromotionEvaluator
    {
        private readonly ThebobDbContext _db;

        public PromotionEvaluator(ThebobDbContext db)
        {
            _db = db;
        }

        /// <summary>
        /// Trả về true nếu promotion đủ điều kiện áp dụng cho context.
        /// </summary>
        public async Task<bool> IsEligibleAsync(
            Models.Promotion.Promotion promotion,
            PromotionContext context,
            List<PromotionCartItem> eligibleItems,
            CancellationToken ct = default)
        {
            var now = DateTime.UtcNow;

            // 1. Kiểm tra status và thời gian
            if (promotion.Status != PromotionStatus.Active) return false;
            if (now < promotion.StartDate || now > promotion.EndDate) return false;

            // 2. Kiểm tra scope có items không
            if (!eligibleItems.Any()) return false;

            // 3. Kiểm tra MinOrderValue (tính trên eligible items)
            var eligibleSubtotal = eligibleItems.Sum(i => i.LineTotal);
            var totalSubtotal = context.Subtotal;

            // MinOrderValue áp dụng trên tổng đơn (không chỉ eligible items)
            if (promotion.MinOrderValue > 0 && totalSubtotal < promotion.MinOrderValue)
                return false;

            if (promotion.MaxOrderValue.HasValue && totalSubtotal > promotion.MaxOrderValue.Value)
                return false;

            // 4. Kiểm tra MinQuantity
            if (promotion.MinQuantity > 0 && context.TotalQuantity < promotion.MinQuantity)
                return false;

            // 5. Kiểm tra tổng usage limit
            if (promotion.UsageLimitTotal > 0 && promotion.UsedCount >= promotion.UsageLimitTotal)
                return false;

            // 6. Kiểm tra per-user limit
            if (promotion.UsageLimitPerUser > 0)
            {
                var userUsageCount = await _db.PromotionUsages
                    .CountAsync(u => u.PromotionId == promotion.Id
                        && u.UserId == context.UserId
                        && !u.IsRolledBack, ct);

                if (userUsageCount >= promotion.UsageLimitPerUser) return false;
            }

            // 7. Kiểm tra per-day limit
            if (promotion.UsageLimitPerDay > 0)
            {
                var today = DateTime.UtcNow.Date;
                var dayUsage = await _db.PromotionUsages
                    .CountAsync(u => u.PromotionId == promotion.Id
                        && u.UsedAt >= today
                        && !u.IsRolledBack, ct);

                if (dayUsage >= promotion.UsageLimitPerDay) return false;
            }

            // 8. Kiểm tra per-month limit
            if (promotion.UsageLimitPerMonth > 0)
            {
                var monthStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
                var monthUsage = await _db.PromotionUsages
                    .CountAsync(u => u.PromotionId == promotion.Id
                        && u.UsedAt >= monthStart
                        && !u.IsRolledBack, ct);

                if (monthUsage >= promotion.UsageLimitPerMonth) return false;
            }

            // 9. Kiểm tra điều kiện user
            if (promotion.RequiresNewUser && !context.User.IsNewUser) return false;

            if (promotion.RequiresBirthdayUser && !context.User.IsBirthMonth) return false;

            if (promotion.RequiresCustomerGroup)
            {
                var allowedGroupIds = promotion.PromotionCustomerGroups
                    .Select(g => g.CustomerGroupId)
                    .ToHashSet();

                if (!context.User.CustomerGroupId.HasValue ||
                    !allowedGroupIds.Contains(context.User.CustomerGroupId.Value))
                    return false;
            }

            return true;
        }

        /// <summary>
        /// Kiểm tra User Coupon (voucher cá nhân) có hợp lệ không.
        /// </summary>
        public async Task<(bool IsValid, string? Error)> ValidateUserCouponAsync(
            int userCouponId, int userId, CancellationToken ct = default)
        {
            var uc = await _db.UserCoupons
                .Include(u => u.Promotion)
                .FirstOrDefaultAsync(u => u.Id == userCouponId && u.UserId == userId, ct);

            if (uc == null) return (false, "Voucher không tồn tại hoặc không thuộc về bạn");
            if (uc.IsUsed) return (false, "Voucher đã được sử dụng");
            if (uc.ExpiresAt.HasValue && uc.ExpiresAt.Value < DateTime.UtcNow)
                return (false, "Voucher đã hết hạn");
            if (uc.Promotion.Status != PromotionStatus.Active)
                return (false, "Chương trình khuyến mãi không còn hoạt động");
            if (DateTime.UtcNow > uc.Promotion.EndDate)
                return (false, "Chương trình khuyến mãi đã kết thúc");

            return (true, null);
        }
    }
}
