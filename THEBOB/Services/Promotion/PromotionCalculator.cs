using THEBOB.Models.Promotion;

namespace THEBOB.Services.Promotion
{
    /// <summary>
    /// Tính số tiền giảm giá thực tế của một Promotion.
    /// Hỗ trợ: Percentage, FixedAmount, FreeShipping, BuyXGetY.
    /// </summary>
    public class PromotionCalculator
    {
        /// <summary>
        /// Tính discount amount của một promotion trên danh sách eligible items.
        /// </summary>
        public (decimal DiscountAmount, decimal ShippingDiscount) Calculate(
            Models.Promotion.Promotion promotion,
            List<PromotionCartItem> eligibleItems,
            decimal totalSubtotal,
            decimal shippingFee)
        {
            var discountBase = eligibleItems.Sum(i => i.LineTotal);

            return promotion.DiscountType switch
            {
                DiscountKind.Percentage => CalculatePercentage(promotion, discountBase),

                DiscountKind.FixedAmount => CalculateFixed(promotion, discountBase, totalSubtotal),

                DiscountKind.FreeShipping => (0, shippingFee),

                DiscountKind.BuyXGetY => CalculateBuyXGetY(promotion, eligibleItems),

                DiscountKind.BundlePrice => CalculateBundle(promotion, eligibleItems),

                _ => (0, 0)
            };
        }

        private static (decimal, decimal) CalculatePercentage(
            Models.Promotion.Promotion promo, decimal discountBase)
        {
            var amount = discountBase * promo.DiscountValue / 100m;

            if (promo.MaxDiscountAmount.HasValue)
                amount = Math.Min(amount, promo.MaxDiscountAmount.Value);

            amount = Math.Round(amount, 0); // Làm tròn về đồng VND
            return (amount, 0);
        }

        private static (decimal, decimal) CalculateFixed(
            Models.Promotion.Promotion promo, decimal discountBase, decimal totalSubtotal)
        {
            // Fixed amount không thể vượt quá giá trị eligible items
            var amount = Math.Min(promo.DiscountValue, discountBase);
            return (amount, 0);
        }

        private static (decimal, decimal) CalculateBuyXGetY(
            Models.Promotion.Promotion promo, List<PromotionCartItem> items)
        {
            if (promo.BuyQuantity <= 0 || promo.GetQuantity <= 0) return (0, 0);

            // Tính số combo có thể áp dụng
            var totalQty = items.Sum(i => i.Quantity);
            var combos = totalQty / (promo.BuyQuantity + promo.GetQuantity);
            if (combos <= 0) return (0, 0);

            // Giá trị được tặng = giá của GetQuantity item rẻ nhất
            var sortedItems = items
                .SelectMany(i => Enumerable.Repeat(i.UnitPrice, i.Quantity))
                .OrderBy(p => p)
                .ToList();

            decimal discount = 0;
            for (int i = 0; i < combos * promo.GetQuantity && i < sortedItems.Count; i++)
            {
                discount += sortedItems[i];
            }

            if (promo.MaxDiscountAmount.HasValue)
                discount = Math.Min(discount, promo.MaxDiscountAmount.Value);

            return (Math.Round(discount, 0), 0);
        }

        private static (decimal, decimal) CalculateBundle(
            Models.Promotion.Promotion promo, List<PromotionCartItem> items)
        {
            // BundlePrice: DiscountValue là giá combo — tính tiết kiệm so với giá gốc
            var originalTotal = items.Sum(i => i.LineTotal);
            if (originalTotal <= promo.DiscountValue) return (0, 0);
            return (Math.Round(originalTotal - promo.DiscountValue, 0), 0);
        }
    }
}
