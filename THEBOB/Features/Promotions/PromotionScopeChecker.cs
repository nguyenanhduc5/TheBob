using THEBOB.Models.Promotion;

namespace THEBOB.Services.Promotion
{
    /// <summary>
    /// Kiểm tra phạm vi áp dụng (Scope) của Promotion với cart items.
    /// Trả về danh sách cart items thực sự bị ảnh hưởng bởi promotion.
    /// </summary>
    public class PromotionScopeChecker
    {
        /// <summary>
        /// Trả về những cart items nằm trong phạm vi của promotion.
        /// Empty list = không có item nào phù hợp.
        /// </summary>
        public List<PromotionCartItem> GetEligibleItems(
            Models.Promotion.Promotion promotion,
            List<PromotionCartItem> cartItems)
        {
            return promotion.Scope switch
            {
                PromotionScope.AllShop => cartItems.ToList(),

                PromotionScope.Product => FilterByProducts(promotion, cartItems),

                PromotionScope.Category => FilterByCategories(promotion, cartItems),

                PromotionScope.Brand => FilterByBrands(promotion, cartItems),

                PromotionScope.Sku => FilterBySku(promotion, cartItems),

                // User / CustomerGroup scope được kiểm tra ở PromotionEvaluator
                PromotionScope.User => cartItems.ToList(),
                PromotionScope.CustomerGroup => cartItems.ToList(),

                _ => cartItems.ToList()
            };
        }

        private static List<PromotionCartItem> FilterByProducts(
            Models.Promotion.Promotion promotion, List<PromotionCartItem> items)
        {
            var productIds = promotion.PromotionProducts
                .Where(pp => !pp.IsExcluded)
                .Select(pp => pp.ProductId)
                .ToHashSet();

            var excludedProductIds = promotion.PromotionProducts
                .Where(pp => pp.IsExcluded)
                .Select(pp => pp.ProductId)
                .ToHashSet();

            if (productIds.Any())
                return items.Where(i => productIds.Contains(i.ProductId)).ToList();

            // Nếu không có whitelist thì dùng blacklist
            return items.Where(i => !excludedProductIds.Contains(i.ProductId)).ToList();
        }

        private static List<PromotionCartItem> FilterByCategories(
            Models.Promotion.Promotion promotion, List<PromotionCartItem> items)
        {
            var categoryIds = promotion.PromotionCategories
                .Where(pc => !pc.IsExcluded)
                .Select(pc => pc.CategoryId)
                .ToHashSet();

            var excludedCategoryIds = promotion.PromotionCategories
                .Where(pc => pc.IsExcluded)
                .Select(pc => pc.CategoryId)
                .ToHashSet();

            if (categoryIds.Any())
                return items.Where(i => i.CategoryId.HasValue && categoryIds.Contains(i.CategoryId.Value)).ToList();

            return items.Where(i => !i.CategoryId.HasValue || !excludedCategoryIds.Contains(i.CategoryId.Value)).ToList();
        }

        private static List<PromotionCartItem> FilterByBrands(
            Models.Promotion.Promotion promotion, List<PromotionCartItem> items)
        {
            var brandIds = promotion.PromotionBrands
                .Where(pb => !pb.IsExcluded)
                .Select(pb => pb.BrandId)
                .ToHashSet();

            var excludedBrandIds = promotion.PromotionBrands
                .Where(pb => pb.IsExcluded)
                .Select(pb => pb.BrandId)
                .ToHashSet();

            if (brandIds.Any())
                return items.Where(i => i.BrandId.HasValue && brandIds.Contains(i.BrandId.Value)).ToList();

            return items.Where(i => !i.BrandId.HasValue || !excludedBrandIds.Contains(i.BrandId.Value)).ToList();
        }

        private static List<PromotionCartItem> FilterBySku(
            Models.Promotion.Promotion promotion, List<PromotionCartItem> items)
        {
            // SKU được encode vào PromotionProducts.ProductId thông qua variant SKU
            // Tạm thời fall-through về AllShop; có thể extend sau
            return items.ToList();
        }
    }
}
