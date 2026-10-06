using THEBOB.Models.Promotion;

namespace THEBOB.Services.Promotion
{
    /// <summary>
    /// Giải quyết stacking và priority khi có nhiều Promotion hợp lệ.
    ///
    /// Thuật toán:
    /// 1. Sort tất cả promotions hợp lệ theo Priority DESC.
    /// 2. Nếu promotion đầu tiên IsStackable = false và không có ExclusiveGroup:
    ///    → Chỉ áp dụng promotion đó (exclusive winner).
    /// 3. Nếu có ExclusiveGroup:
    ///    → Trong mỗi group, chỉ lấy 1 promotion ưu tiên cao nhất.
    ///    → Các group khác nhau có thể stack.
    /// 4. Các promotion IsStackable = true được cộng dồn.
    ///    → MaxStackCount giới hạn số lượng stackable promotions.
    /// 5. Rule đặc biệt: FreeShipping luôn stack được (thuộc ExclusiveGroup "shipping").
    /// </summary>
    public class PromotionStackingResolver
    {
        public List<Models.Promotion.Promotion> Resolve(
            List<Models.Promotion.Promotion> eligiblePromotions)
        {
            if (!eligiblePromotions.Any()) return new();

            // Sort by Priority DESC
            var sorted = eligiblePromotions
                .OrderByDescending(p => p.Priority)
                .ToList();

            var result = new List<Models.Promotion.Promotion>();
            var usedGroups = new HashSet<string>();
            bool hasExclusiveWinner = false;

            foreach (var promo in sorted)
            {
                // Nếu đã có exclusive winner (IsStackable=false, no group) → dừng
                if (hasExclusiveWinner && !promo.IsStackable) continue;
                if (hasExclusiveWinner && string.IsNullOrEmpty(promo.ExclusiveGroup)) continue;

                // Nếu promo có ExclusiveGroup → chỉ lấy 1 promo trong group đó
                if (!string.IsNullOrEmpty(promo.ExclusiveGroup))
                {
                    if (usedGroups.Contains(promo.ExclusiveGroup)) continue;
                    usedGroups.Add(promo.ExclusiveGroup);
                    result.Add(promo);
                    continue;
                }

                // Promo không có group
                if (!promo.IsStackable)
                {
                    // Exclusive — nếu chưa có gì trong result thì thêm và đặt flag
                    if (!result.Any(r => !r.IsStackable && string.IsNullOrEmpty(r.ExclusiveGroup)))
                    {
                        result.Add(promo);
                        hasExclusiveWinner = true;
                    }
                    continue;
                }

                // IsStackable = true
                // Đếm số stackable đã có (không tính những promo từ ExclusiveGroup)
                var currentStackCount = result.Count(r => r.IsStackable && string.IsNullOrEmpty(r.ExclusiveGroup));

                // Kiểm tra MaxStackCount của promo hiện tại
                if (promo.MaxStackCount > 0 && currentStackCount >= promo.MaxStackCount) continue;

                result.Add(promo);
            }

            return result;
        }

        /// <summary>
        /// Tách riêng FreeShipping promotions — chúng luôn được xử lý độc lập.
        /// </summary>
        public (List<Models.Promotion.Promotion> PricePromos,
                List<Models.Promotion.Promotion> ShippingPromos)
            Separate(List<Models.Promotion.Promotion> promotions)
        {
            var shipping = promotions.Where(p => p.DiscountType == DiscountKind.FreeShipping).ToList();
            var price = promotions.Where(p => p.DiscountType != DiscountKind.FreeShipping).ToList();
            return (price, shipping);
        }
    }
}
