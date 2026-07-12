using Microsoft.EntityFrameworkCore;
using THEBOB.Data;
using THEBOB.DTOs.Chat;
using THEBOB.Models.Promotion;

namespace THEBOB.Services.Chat
{
    public class ProductContextService : IProductContextService
    {
        private readonly ThebobDbContext _context;

        public ProductContextService(ThebobDbContext context)
        {
            _context = context;
        }

        public async Task<ProductContextDto?> BuildContextAsync(int productId)
        {
            var product = await _context.Products
                .Include(p => p.Category)
                .Include(p => p.Brand)
                .Include(p => p.ProductVariants)
                    .ThenInclude(v => v.Size)
                .Include(p => p.ProductVariants)
                    .ThenInclude(v => v.Color)
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == productId);

            if (product == null)
            {
                return null;
            }

            var dto = new ProductContextDto
            {
                Id = product.Id,
                Name = product.Name,
                Description = product.Description,
                Material = product.Material,
                CategoryName = product.Category?.Name ?? "Chưa phân loại",
                BrandName = product.Brand?.Name ?? "THEBOB",
                Rating = product.Rating,
                ReviewCount = product.ReviewCount
            };

            foreach (var variant in product.ProductVariants.Where(v => !v.IsDeleted && v.IsAvailable))
            {
                dto.Variants.Add(new ProductContextDto.VariantInfo
                {
                    Id = variant.Id,
                    Sku = variant.Sku,
                    Size = variant.Size?.Name ?? "Freesize",
                    Color = variant.Color?.Name ?? "Mặc định",
                    Price = variant.Price,
                    Stock = variant.Stock,
                    Sold = 0 // Sold logic might need Order details, defaulting to 0 for AI context
                });
            }

            if (dto.Variants.Any())
            {
                dto.MinPrice = dto.Variants.Min(v => v.Price);
                dto.MaxPrice = dto.Variants.Max(v => v.Price);
            }

            // Find best promotion (simple logic for AI context)
            // It looks for active Automatic promotions matching the product
            var now = DateTime.UtcNow;
            
            var applicablePromotions = await _context.Promotions
                .Include(p => p.PromotionProducts)
                .Include(p => p.PromotionCategories)
                .Include(p => p.PromotionBrands)
                .Where(p => p.Type == PromotionType.Automatic
                            && p.Status == PromotionStatus.Active
                            && p.StartDate <= now
                            && p.EndDate >= now
                            && p.DiscountType == DiscountKind.Percentage) // Percentage for simpler AI context
                .AsNoTracking()
                .ToListAsync();

            decimal bestDiscount = 0;

            foreach (var promo in applicablePromotions)
            {
                bool applies = promo.Scope == PromotionScope.AllShop ||
                               (promo.Scope == PromotionScope.Product && promo.PromotionProducts.Any(pp => pp.ProductId == product.Id)) ||
                               (promo.Scope == PromotionScope.Category && product.CategoryId.HasValue && promo.PromotionCategories.Any(pc => pc.CategoryId == product.CategoryId.Value)) ||
                               (promo.Scope == PromotionScope.Brand && product.BrandId.HasValue && promo.PromotionBrands.Any(pb => pb.BrandId == product.BrandId.Value));

                if (applies && promo.DiscountValue > bestDiscount)
                {
                    bestDiscount = promo.DiscountValue;
                }
            }

            dto.PromotionPercent = bestDiscount;

            return dto;
        }
    }
}
