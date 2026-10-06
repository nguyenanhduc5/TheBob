using THEBOB.Data;
using THEBOB.Models.Promotion;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using System.Text.Json;

namespace THEBOB.Services.Promotion
{
    /// <summary>
    /// Orchestrator chính của Promotion Engine.
    /// Load → Evaluate → Stack → Calculate → Commit/Rollback.
    /// </summary>
    public class PromotionEngine : IPromotionEngine
    {
        private readonly ThebobDbContext _db;
        private readonly PromotionEvaluator _evaluator;
        private readonly PromotionScopeChecker _scopeChecker;
        private readonly PromotionCalculator _calculator;
        private readonly PromotionStackingResolver _stackingResolver;
        private readonly IMemoryCache _cache;
        private readonly ILogger<PromotionEngine> _logger;

        private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(5);
        private const string ActivePromotionsCacheKey = "promotions:active";

        public PromotionEngine(
            ThebobDbContext db,
            PromotionEvaluator evaluator,
            PromotionScopeChecker scopeChecker,
            PromotionCalculator calculator,
            PromotionStackingResolver stackingResolver,
            IMemoryCache cache,
            ILogger<PromotionEngine> logger)
        {
            _db = db;
            _evaluator = evaluator;
            _scopeChecker = scopeChecker;
            _calculator = calculator;
            _stackingResolver = stackingResolver;
            _cache = cache;
            _logger = logger;
        }

        // ─────────────────────────────────────────────────────────────────────

        public async Task<PromotionResult> CalculateAsync(
            PromotionContext context, CancellationToken ct = default)
        {
            var result = new PromotionResult
            {
                Subtotal = context.Subtotal,
                ShippingFee = context.ShippingFee
            };

            if (!context.CartItems.Any()) return result;

            // 1. Load tất cả promotions active
            var allActive = await GetActivePromotionsAsync(ct);

            // 2. Lọc Automatic promotions (không phải Coupon type và không có CouponCode)
            var automaticPromos = allActive
                .Where(p => p.Type != PromotionType.Coupon && string.IsNullOrEmpty(p.CouponCode))
                .ToList();

            // 3. Evaluate automatic promotions
            var eligibleAutomatic = new List<Models.Promotion.Promotion>();
            foreach (var promo in automaticPromos)
            {
                var eligibleItems = _scopeChecker.GetEligibleItems(promo, context.CartItems);
                if (await _evaluator.IsEligibleAsync(promo, context, eligibleItems, ct))
                {
                    eligibleAutomatic.Add(promo);
                }
            }

            // 4. Resolve stacking (Automatic)
            var (pricePromos, shippingPromos) = _stackingResolver.Separate(eligibleAutomatic);
            var resolvedPricePromos = _stackingResolver.Resolve(pricePromos);
            var resolvedShippingPromos = _stackingResolver.Resolve(shippingPromos);

            // 5. Tính discount cho Automatic promotions
            foreach (var promo in resolvedPricePromos)
            {
                var eligibleItems = _scopeChecker.GetEligibleItems(promo, context.CartItems);
                var (disc, shipDisc) = _calculator.Calculate(promo, eligibleItems, context.Subtotal, context.ShippingFee);

                if (disc > 0)
                {
                    result.AutomaticDiscount += disc;
                    result.AppliedPromotions.Add(new AppliedPromotionInfo
                    {
                        PromotionId = promo.Id,
                        PromotionName = promo.Name,
                        DiscountType = promo.DiscountType.ToString(),
                        DiscountValue = promo.DiscountValue,
                        DiscountApplied = disc,
                        PromotionTypeName = promo.Type.ToString()
                    });
                }
            }

            foreach (var promo in resolvedShippingPromos)
            {
                var eligibleItems = _scopeChecker.GetEligibleItems(promo, context.CartItems);
                var (disc, shipDisc) = _calculator.Calculate(promo, eligibleItems, context.Subtotal, context.ShippingFee);

                if (shipDisc > 0)
                {
                    result.ShippingDiscount = Math.Min(result.ShippingDiscount + shipDisc, context.ShippingFee);
                    result.AppliedPromotions.Add(new AppliedPromotionInfo
                    {
                        PromotionId = promo.Id,
                        PromotionName = promo.Name,
                        DiscountType = "FreeShipping",
                        DiscountValue = promo.DiscountValue,
                        DiscountApplied = shipDisc,
                        PromotionTypeName = promo.Type.ToString()
                    });
                }
            }

            // 6. Xử lý Coupon Code (nếu có)
            if (!string.IsNullOrWhiteSpace(context.CouponCode))
            {
                var couponResult = await ApplyCouponCodeAsync(context, ct);
                if (couponResult.HasValue)
                {
                    var (couponDisc, couponShipDisc, couponInfo) = couponResult.Value;
                    result.CouponDiscount += couponDisc;
                    result.ShippingDiscount = Math.Min(result.ShippingDiscount + couponShipDisc, context.ShippingFee);
                    result.AppliedCouponCode = context.CouponCode.ToUpper();
                    result.AppliedPromotions.Add(couponInfo);
                }
            }

            // 7. Xử lý UserCoupon (voucher cá nhân)
            if (context.UserCouponId.HasValue)
            {
                var ucResult = await ApplyUserCouponAsync(context, ct);
                if (ucResult.HasValue)
                {
                    var (ucDisc, ucShipDisc, ucInfo) = ucResult.Value;
                    result.CouponDiscount += ucDisc;
                    result.ShippingDiscount = Math.Min(result.ShippingDiscount + ucShipDisc, context.ShippingFee);
                    result.AppliedCouponCode = ucInfo.CouponCode ?? ucInfo.PromotionName;
                    result.AppliedPromotions.Add(ucInfo);
                }
            }

            // 8. Đảm bảo discount không vượt quá subtotal
            result.AutomaticDiscount = Math.Min(result.AutomaticDiscount, context.Subtotal);
            result.CouponDiscount = Math.Min(result.CouponDiscount, context.Subtotal - result.AutomaticDiscount);

            _logger.LogInformation(
                "PromotionEngine: UserId={UserId}, Subtotal={Subtotal:C}, TotalDiscount={Discount:C}, Applied={Count}",
                context.UserId, context.Subtotal, result.TotalDiscount,
                result.AppliedPromotions.Count);

            return result;
        }

        // ─────────────────────────────────────────────────────────────────────

        public async Task<(bool IsValid, string? ErrorMessage, Models.Promotion.Promotion? Promotion)>
            ValidateCouponAsync(string couponCode, PromotionContext context, CancellationToken ct = default)
        {
            var code = couponCode.Trim().ToUpper();
            var promo = await _db.Promotions
                .Include(p => p.PromotionProducts)
                .Include(p => p.PromotionCategories)
                .Include(p => p.PromotionBrands)
                .Include(p => p.PromotionCustomerGroups)
                .FirstOrDefaultAsync(p => p.CouponCode == code && p.Status == PromotionStatus.Active, ct);

            if (promo == null)
                return (false, "Mã giảm giá không tồn tại hoặc đã hết hạn", null);

            if (DateTime.UtcNow < promo.StartDate)
                return (false, "Mã giảm giá chưa bắt đầu", null);

            if (DateTime.UtcNow > promo.EndDate)
                return (false, "Mã giảm giá đã hết hạn", null);

            if (promo.UsageLimitTotal > 0 && promo.UsedCount >= promo.UsageLimitTotal)
                return (false, "Mã giảm giá đã hết lượt sử dụng", null);

            var eligibleItems = _scopeChecker.GetEligibleItems(promo, context.CartItems);
            var isEligible = await _evaluator.IsEligibleAsync(promo, context, eligibleItems, ct);

            if (!isEligible)
                return (false, "Mã giảm giá không áp dụng được cho đơn hàng này", null);

            return (true, null, promo);
        }

        public async Task<List<Models.Promotion.Promotion>> GetApplicablePromotionsAsync(
            PromotionContext context, CancellationToken ct = default)
        {
            var allActive = await GetActivePromotionsAsync(ct);
            var applicable = new List<Models.Promotion.Promotion>();

            foreach (var promo in allActive.Where(p => string.IsNullOrEmpty(p.CouponCode)))
            {
                var eligibleItems = _scopeChecker.GetEligibleItems(promo, context.CartItems);
                if (await _evaluator.IsEligibleAsync(promo, context, eligibleItems, ct))
                    applicable.Add(promo);
            }

            return applicable;
        }

        // ─────────────────────────────────────────────────────────────────────
        // Commit / Rollback
        // ─────────────────────────────────────────────────────────────────────

        public async Task CommitUsageAsync(
            int orderId, int userId, PromotionResult result, CancellationToken ct = default)
        {
            if (!result.AppliedPromotions.Any()) return;

            foreach (var applied in result.AppliedPromotions.Where(a => a.PromotionId.HasValue))
            {
                // Tăng UsedCount
                await _db.Promotions
                    .Where(p => p.Id == applied.PromotionId!.Value)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(p => p.UsedCount, p => p.UsedCount + 1)
                        .SetProperty(p => p.UpdatedAt, DateTime.UtcNow), ct);

                // Lưu PromotionUsage
                _db.PromotionUsages.Add(new PromotionUsage
                {
                    PromotionId = applied.PromotionId!.Value,
                    UserId = userId,
                    OrderId = orderId,
                    DiscountApplied = applied.DiscountApplied,
                    UsedAt = DateTime.UtcNow
                });

                // Lưu OrderPromotion (snapshot)
                _db.OrderPromotions.Add(new OrderPromotion
                {
                    OrderId = orderId,
                    PromotionId = applied.PromotionId,
                    PromotionName = applied.PromotionName,
                    DiscountType = applied.DiscountType,
                    DiscountValue = applied.DiscountValue,
                    CouponCode = applied.CouponCode,
                    DiscountApplied = applied.DiscountApplied,
                    PromotionType = applied.PromotionTypeName,
                    AppliedAt = DateTime.UtcNow
                });
            }

            // Đánh dấu UserCoupon nếu có
            if (result.AppliedCouponCode != null)
            {
                var userCoupon = await _db.UserCoupons
                    .Include(uc => uc.Promotion)
                    .FirstOrDefaultAsync(uc =>
                        uc.UserId == userId &&
                        uc.Promotion.CouponCode == result.AppliedCouponCode &&
                        !uc.IsUsed, ct);

                if (userCoupon != null)
                {
                    userCoupon.IsUsed = true;
                    userCoupon.UsedAt = DateTime.UtcNow;
                }
            }

            await _db.SaveChangesAsync(ct);

            // Invalidate cache
            _cache.Remove(ActivePromotionsCacheKey);
        }

        public async Task RollbackUsageAsync(int orderId, CancellationToken ct = default)
        {
            var usages = await _db.PromotionUsages
                .Where(u => u.OrderId == orderId && !u.IsRolledBack)
                .ToListAsync(ct);

            if (!usages.Any()) return;

            foreach (var usage in usages)
            {
                usage.IsRolledBack = true;
                usage.RolledBackAt = DateTime.UtcNow;

                // Giảm UsedCount
                await _db.Promotions
                    .Where(p => p.Id == usage.PromotionId)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(p => p.UsedCount, p => Math.Max(0, p.UsedCount - 1))
                        .SetProperty(p => p.UpdatedAt, DateTime.UtcNow), ct);
            }

            // Rollback UserCoupon nếu có
            var orderPromotions = await _db.OrderPromotions
                .Where(op => op.OrderId == orderId && op.CouponCode != null)
                .ToListAsync(ct);

            foreach (var op in orderPromotions)
            {
                var userCoupon = await _db.UserCoupons
                    .Include(uc => uc.Promotion)
                    .FirstOrDefaultAsync(uc =>
                        uc.Promotion.CouponCode == op.CouponCode && uc.IsUsed, ct);

                if (userCoupon != null)
                {
                    userCoupon.IsUsed = false;
                    userCoupon.UsedAt = null;
                }
            }

            await _db.SaveChangesAsync(ct);
            _cache.Remove(ActivePromotionsCacheKey);

            _logger.LogInformation("Rolled back {Count} promotion usages for OrderId={OrderId}", usages.Count, orderId);
        }

        // ─────────────────────────────────────────────────────────────────────
        // Private helpers
        // ─────────────────────────────────────────────────────────────────────

        private async Task<List<Models.Promotion.Promotion>> GetActivePromotionsAsync(CancellationToken ct)
        {
            if (_cache.TryGetValue(ActivePromotionsCacheKey, out List<Models.Promotion.Promotion>? cached) && cached != null)
                return cached;

            var now = DateTime.UtcNow;
            var promotions = await _db.Promotions
                .Include(p => p.PromotionProducts)
                .Include(p => p.PromotionCategories)
                .Include(p => p.PromotionBrands)
                .Include(p => p.PromotionCustomerGroups)
                .Where(p => p.Status == PromotionStatus.Active
                    && p.StartDate <= now
                    && p.EndDate >= now)
                .OrderByDescending(p => p.Priority)
                .AsNoTracking()
                .ToListAsync(ct);

            _cache.Set(ActivePromotionsCacheKey, promotions, CacheDuration);
            return promotions;
        }

        private async Task<(decimal disc, decimal shipDisc, AppliedPromotionInfo info)?> ApplyCouponCodeAsync(
            PromotionContext context, CancellationToken ct)
        {
            var (isValid, error, promo) = await ValidateCouponAsync(context.CouponCode!, context, ct);
            if (!isValid || promo == null) return null;

            var eligibleItems = _scopeChecker.GetEligibleItems(promo, context.CartItems);
            var (disc, shipDisc) = _calculator.Calculate(promo, eligibleItems, context.Subtotal, context.ShippingFee);

            return (disc, shipDisc, new AppliedPromotionInfo
            {
                PromotionId = promo.Id,
                PromotionName = promo.Name,
                DiscountType = promo.DiscountType.ToString(),
                DiscountValue = promo.DiscountValue,
                DiscountApplied = disc + shipDisc,
                CouponCode = promo.CouponCode,
                PromotionTypeName = promo.Type.ToString()
            });
        }

        private async Task<(decimal disc, decimal shipDisc, AppliedPromotionInfo info)?> ApplyUserCouponAsync(
            PromotionContext context, CancellationToken ct)
        {
            var (isValid, error) = await _evaluator.ValidateUserCouponAsync(
                context.UserCouponId!.Value, context.UserId, ct);

            if (!isValid) return null;

            var uc = await _db.UserCoupons
                .Include(u => u.Promotion)
                    .ThenInclude(p => p.PromotionProducts)
                .Include(u => u.Promotion)
                    .ThenInclude(p => p.PromotionCategories)
                .Include(u => u.Promotion)
                    .ThenInclude(p => p.PromotionBrands)
                .Include(u => u.Promotion)
                    .ThenInclude(p => p.PromotionCustomerGroups)
                .FirstOrDefaultAsync(u => u.Id == context.UserCouponId!.Value, ct);

            if (uc == null || uc.Promotion == null) return null;

            var promo = uc.Promotion;
            var eligibleItems = _scopeChecker.GetEligibleItems(promo, context.CartItems);

            // Kiểm tra đầy đủ điều kiện (Scope, MinOrderValue, MaxOrderValue, MinQuantity, v.v.)
            var isEligible = await _evaluator.IsEligibleAsync(promo, context, eligibleItems, ct);
            if (!isEligible) return null;

            var (disc, shipDisc) = _calculator.Calculate(promo, eligibleItems, context.Subtotal, context.ShippingFee);
            if (disc <= 0 && shipDisc <= 0) return null;

            return (disc, shipDisc, new AppliedPromotionInfo
            {
                PromotionId = promo.Id,
                PromotionName = promo.Name,
                DiscountType = promo.DiscountType.ToString(),
                DiscountValue = promo.DiscountValue,
                DiscountApplied = disc + shipDisc,
                CouponCode = promo.CouponCode,
                PromotionTypeName = "Voucher"
            });
        }
    }
}
