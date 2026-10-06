using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using THEBOB.Data;
using THEBOB.DTOs.Promotion;
using THEBOB.Models;
using THEBOB.Models.Promotion;

namespace THEBOB.Services.Promotion
{
    public class PromotionManagementService : IPromotionManagementService
    {
        private readonly ThebobDbContext _db;
        private readonly IPromotionEngine _engine;
        private readonly IMemoryCache _cache;
        private readonly ILogger<PromotionManagementService> _logger;
        private const string CacheKey = "promotions:active";

        public PromotionManagementService(
            ThebobDbContext db,
            IPromotionEngine engine,
            IMemoryCache cache,
            ILogger<PromotionManagementService> logger)
        {
            _db = db;
            _engine = engine;
            _cache = cache;
            _logger = logger;
        }

        public async Task<object> GetAllAsync(PromotionStatus? status, PromotionType? type, int page, int pageSize)
        {
            var query = _db.Promotions.AsNoTracking().AsQueryable();

            if (status.HasValue) query = query.Where(p => p.Status == status.Value);
            if (type.HasValue) query = query.Where(p => p.Type == type.Value);

            var total = await query.CountAsync();
            var now = DateTime.UtcNow;

            var items = await query
                .OrderByDescending(p => p.Priority)
                .ThenByDescending(p => p.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(p => new PromotionSummaryDto
                {
                    Id = p.Id,
                    Name = p.Name,
                    Type = p.Type.ToString(),
                    Status = p.Status.ToString(),
                    DiscountType = p.DiscountType.ToString(),
                    DiscountValue = p.DiscountValue,
                    EndDate = p.EndDate,
                    UsedCount = p.UsedCount,
                    IsActive = p.Status == PromotionStatus.Active && p.StartDate <= now && p.EndDate >= now
                })
                .ToListAsync();

            return new { total, page, pageSize, items };
        }

        public async Task<(bool Success, string Message, int StatusCode, PromotionDto? Data)> GetByIdAsync(int id)
        {
            var p = await _db.Promotions
                .Include(x => x.PromotionProducts)
                .Include(x => x.PromotionCategories)
                .Include(x => x.PromotionBrands)
                .Include(x => x.PromotionCustomerGroups)
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == id);

            if (p == null)
                return (false, "Không tìm thấy chương trình khuyến mãi", 404, null);

            var now = DateTime.UtcNow;
            return (true, string.Empty, 200, ToDto(p, now));
        }

        public async Task<(bool Success, string Message, int StatusCode, PromotionDto? Data)> CreateAsync(CreatePromotionRequest req, string createdBy)
        {
            if (!string.IsNullOrWhiteSpace(req.CouponCode))
            {
                var code = req.CouponCode.Trim().ToUpper();
                if (await _db.Promotions.AnyAsync(p => p.CouponCode == code))
                    return (false, "Mã coupon đã tồn tại", 400, null);
                req.CouponCode = code;
            }

            var promo = MapFromRequest(req);
            promo.CreatedBy = createdBy;
            _db.Promotions.Add(promo);
            await _db.SaveChangesAsync();

            await AddScopeRelationsAsync(promo, req);
            InvalidateCache();

            _logger.LogInformation("Promotion created: {Name} (Id={Id})", promo.Name, promo.Id);
            return (true, string.Empty, 201, ToDto(promo, DateTime.UtcNow));
        }

        public async Task<(bool Success, string Message, int StatusCode, PromotionDto? Data)> UpdateAsync(int id, CreatePromotionRequest req)
        {
            var promo = await _db.Promotions
                .Include(p => p.PromotionProducts)
                .Include(p => p.PromotionCategories)
                .Include(p => p.PromotionBrands)
                .Include(p => p.PromotionCustomerGroups)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (promo == null)
                return (false, "Không tìm thấy chương trình khuyến mãi", 404, null);

            if (!string.IsNullOrWhiteSpace(req.CouponCode))
            {
                var code = req.CouponCode.Trim().ToUpper();
                if (await _db.Promotions.AnyAsync(p => p.CouponCode == code && p.Id != id))
                    return (false, "Mã coupon đã tồn tại", 400, null);
                req.CouponCode = code;
            }

            UpdateFromRequest(promo, req);

            _db.RemoveRange(promo.PromotionProducts);
            _db.RemoveRange(promo.PromotionCategories);
            _db.RemoveRange(promo.PromotionBrands);
            _db.RemoveRange(promo.PromotionCustomerGroups);
            await _db.SaveChangesAsync();

            await AddScopeRelationsAsync(promo, req);
            InvalidateCache();

            return (true, string.Empty, 200, ToDto(promo, DateTime.UtcNow));
        }
        public async Task<(bool Success, string Message, int StatusCode, object? Data)> UpdateStatusAsync(int id, PromotionStatus status)
        {
            var promo = await _db.Promotions.FindAsync(id);
            if (promo == null) return (false, "Not found", 404, null);

            promo.Status = status;
            promo.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            InvalidateCache();

            return (true, $"Đã cập nhật trạng thái thành {status}", 200, new { message = $"Đã cập nhật trạng thái thành {status}", status = status.ToString() });
        }

        public async Task<(bool Success, string Message, int StatusCode, object? Data)> CloneAsync(int id, string createdBy)
        {
            var original = await _db.Promotions
                .Include(p => p.PromotionProducts)
                .Include(p => p.PromotionCategories)
                .Include(p => p.PromotionBrands)
                .Include(p => p.PromotionCustomerGroups)
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == id);

            if (original == null) return (false, "Not found", 404, null);

            var clone = new Models.Promotion.Promotion
            {
                Name = $"[Copy] {original.Name}",
                Description = original.Description,
                BannerUrl = original.BannerUrl,
                Type = original.Type,
                Status = PromotionStatus.Draft,
                Priority = original.Priority,
                IsStackable = original.IsStackable,
                MaxStackCount = original.MaxStackCount,
                ExclusiveGroup = original.ExclusiveGroup,
                DiscountType = original.DiscountType,
                DiscountValue = original.DiscountValue,
                MaxDiscountAmount = original.MaxDiscountAmount,
                MinOrderValue = original.MinOrderValue,
                MaxOrderValue = original.MaxOrderValue,
                MinQuantity = original.MinQuantity,
                StartDate = DateTime.UtcNow,
                EndDate = original.EndDate > DateTime.UtcNow ? original.EndDate : DateTime.UtcNow.AddMonths(1),
                UsageLimitTotal = original.UsageLimitTotal,
                UsageLimitPerUser = original.UsageLimitPerUser,
                UsageLimitPerDay = original.UsageLimitPerDay,
                UsageLimitPerMonth = original.UsageLimitPerMonth,
                Scope = original.Scope,
                CouponCode = null,
                IsPersonal = original.IsPersonal,
                RequiresNewUser = original.RequiresNewUser,
                RequiresCustomerGroup = original.RequiresCustomerGroup,
                RequiresBirthdayUser = original.RequiresBirthdayUser,
                BuyQuantity = original.BuyQuantity,
                GetQuantity = original.GetQuantity,
                GetProductId = original.GetProductId,
                CreatedBy = createdBy,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _db.Promotions.Add(clone);
            await _db.SaveChangesAsync();

            foreach (var pp in original.PromotionProducts)
                _db.PromotionProducts.Add(new PromotionProduct { PromotionId = clone.Id, ProductId = pp.ProductId, IsExcluded = pp.IsExcluded });
            foreach (var pc in original.PromotionCategories)
                _db.PromotionCategories.Add(new PromotionCategory { PromotionId = clone.Id, CategoryId = pc.CategoryId, IsExcluded = pc.IsExcluded });
            foreach (var pb in original.PromotionBrands)
                _db.PromotionBrands.Add(new PromotionBrand { PromotionId = clone.Id, BrandId = pb.BrandId, IsExcluded = pb.IsExcluded });
            foreach (var pg in original.PromotionCustomerGroups)
                _db.PromotionCustomerGroups.Add(new PromotionCustomerGroup { PromotionId = clone.Id, CustomerGroupId = pg.CustomerGroupId });

            await _db.SaveChangesAsync();
            return (true, "Đã clone thành công", 200, new { message = "Đã clone thành công", id = clone.Id });
        }

        public async Task<(bool Success, string Message, int StatusCode, bool NoContent)> DeleteAsync(int id)
        {
            var promo = await _db.Promotions.FindAsync(id);
            if (promo == null) return (false, "Not found", 404, false);

            bool hasUsages = await _db.PromotionUsages.AnyAsync(u => u.PromotionId == id);
            if (hasUsages)
            {
                promo.Status = PromotionStatus.Ended;
                promo.EndDate = DateTime.UtcNow.AddDays(-1);
                promo.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
                return (true, "Chương trình đã được kết thúc (có lịch sử dùng, không xóa vĩnh viễn)", 200, false);
            }

            _db.Promotions.Remove(promo);
            await _db.SaveChangesAsync();
            InvalidateCache();

            return (true, string.Empty, 204, true);
        }

        public async Task<(bool Success, string Message, int StatusCode, PromotionStatsDto? Data)> GetStatsAsync(int id)
        {
            var promo = await _db.Promotions.FindAsync(id);
            if (promo == null) return (false, "Not found", 404, null);

            var usages = await _db.PromotionUsages
                .Where(u => u.PromotionId == id && !u.IsRolledBack)
                .ToListAsync();

            var stats = new PromotionStatsDto
            {
                PromotionId = id,
                Name = promo.Name,
                TotalUsages = usages.Count,
                TotalDiscountGiven = usages.Sum(u => u.DiscountApplied),
                TotalOrders = usages.Select(u => u.OrderId).Distinct().Count()
            };

            return (true, string.Empty, 200, stats);
        }

        public async Task<PromotionStatsSummaryDto> GetStatsSummaryAsync()
        {
            var usages = await _db.PromotionUsages
                .Include(u => u.Promotion)
                .Where(u => !u.IsRolledBack)
                .ToListAsync();

            var topPromos = usages
                .GroupBy(u => new { u.PromotionId, u.Promotion.Name })
                .Select(g => new PromotionStatsDto
                {
                    PromotionId = g.Key.PromotionId,
                    Name = g.Key.Name,
                    TotalUsages = g.Count(),
                    TotalDiscountGiven = g.Sum(u => u.DiscountApplied),
                    TotalOrders = g.Select(u => u.OrderId).Distinct().Count()
                })
                .OrderByDescending(s => s.TotalDiscountGiven)
                .Take(10)
                .ToList();

            return new PromotionStatsSummaryDto
            {
                TotalDiscountGiven = usages.Sum(u => u.DiscountApplied),
                TotalOrdersWithPromotion = usages.Select(u => u.OrderId).Distinct().Count(),
                TopPromotions = topPromos
            };
        }

        public async Task<object> GetUsagesAsync(int id, int page, int pageSize)
        {
            var query = _db.PromotionUsages
                .Include(u => u.User)
                .Include(u => u.Order)
                .Where(u => u.PromotionId == id)
                .OrderByDescending(u => u.UsedAt);

            var total = await query.CountAsync();
            var items = await query
                .Skip((page - 1) * pageSize).Take(pageSize)
                .Select(u => new
                {
                    u.Id, u.UserId, UserEmail = u.User.Email,
                    u.OrderId, u.DiscountApplied, u.UsedAt,
                    u.IsRolledBack, u.RolledBackAt
                })
                .ToListAsync();

            return new { total, page, pageSize, items };
        }
        public async Task<(bool Success, string Message, int StatusCode, object? Data)> SendUserCouponAsync(SendUserCouponRequest req)
        {
            var promo = await _db.Promotions.FindAsync(req.PromotionId);
            if (promo == null) return (false, "Không tìm thấy promotion", 404, null);

            var user = await _db.Users.FindAsync(req.UserId);
            if (user == null) return (false, "Không tìm thấy người dùng", 404, null);

            bool alreadySent = await _db.UserCoupons
                .AnyAsync(uc => uc.PromotionId == req.PromotionId && uc.UserId == req.UserId && !uc.IsUsed);
            if (alreadySent)
                return (false, "Người dùng đã có voucher này chưa dùng", 400, null);

            var userCoupon = new UserCoupon
            {
                PromotionId = req.PromotionId,
                UserId = req.UserId,
                ExpiresAt = req.ExpiresAt,
                Note = req.Note,
                CreatedAt = DateTime.UtcNow
            };
            _db.UserCoupons.Add(userCoupon);

            _db.Notifications.Add(new Notification
            {
                UserId = req.UserId,
                Message = $"🎁 Bạn vừa nhận được voucher: {promo.Name}" +
                          (string.IsNullOrEmpty(req.Note) ? "" : $" — {req.Note}"),
                Type = "Voucher",
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            });

            await _db.SaveChangesAsync();
            return (true, string.Empty, 200, new { message = $"Đã gửi voucher đến {user.Email}", userCouponId = userCoupon.Id });
        }

        public async Task<(bool Success, string Message, int StatusCode, object? Data)> SendBulkCouponAsync(SendBulkCouponRequest req)
        {
            var promo = await _db.Promotions.FindAsync(req.PromotionId);
            if (promo == null) return (false, "Không tìm thấy promotion", 404, null);

            var users = await _db.Users
                .Where(u => req.UserIds.Contains(u.Id) && u.IsActive)
                .ToListAsync();

            int sent = 0;
            foreach (var user in users)
            {
                bool alreadySent = await _db.UserCoupons
                    .AnyAsync(uc => uc.PromotionId == req.PromotionId && uc.UserId == user.Id && !uc.IsUsed);
                if (alreadySent) continue;

                _db.UserCoupons.Add(new UserCoupon
                {
                    PromotionId = req.PromotionId,
                    UserId = user.Id,
                    ExpiresAt = req.ExpiresAt,
                    Note = req.Note,
                    CreatedAt = DateTime.UtcNow
                });

                _db.Notifications.Add(new Notification
                {
                    UserId = user.Id,
                    Message = $"🎁 Bạn vừa nhận được voucher: {promo.Name}",
                    Type = "Voucher",
                    IsRead = false,
                    CreatedAt = DateTime.UtcNow
                });
                sent++;
            }

            await _db.SaveChangesAsync();
            return (true, string.Empty, 200, new { message = $"Đã gửi voucher đến {sent} người dùng", sent });
        }

        public async Task<ValidateCouponResponse> ValidateCouponAsync(int userId, string couponCode)
        {
            var context = await BuildContextAsync(userId, null);
            context.CouponCode = couponCode;

            var (isValid, error, promo) = await _engine.ValidateCouponAsync(couponCode, context);
            if (!isValid)
                return new ValidateCouponResponse { IsValid = false, ErrorMessage = error };

            decimal estimated = 0;
            if (promo != null)
            {
                var result = await _engine.CalculateAsync(context);
                estimated = result.CouponDiscount;
            }

            return new ValidateCouponResponse
            {
                IsValid = true,
                EstimatedDiscount = estimated,
                Promotion = promo != null ? ToDto(promo, DateTime.UtcNow) : null
            };
        }

        public async Task<object> CalculatePromotionsAsync(int userId, CalculatePromotionsRequest req)
        {
            var context = await BuildContextAsync(userId, req.CouponCode, req.UserCouponId, req.ShippingFee);
            var result = await _engine.CalculateAsync(context);

            return new
            {
                automaticDiscount = result.AutomaticDiscount,
                couponDiscount = result.CouponDiscount,
                shippingDiscount = result.ShippingDiscount,
                totalDiscount = result.TotalDiscount,
                subtotal = result.Subtotal,
                shipping = result.FinalShipping,
                finalAmount = result.FinalAmount,
                appliedCouponCode = result.AppliedCouponCode,
                appliedPromotions = result.AppliedPromotions
            };
        }

        public async Task<List<UserCouponDto>> GetMyVouchersAsync(int userId)
        {
            var now = DateTime.UtcNow;
            var vouchers = await _db.UserCoupons
                .Include(uc => uc.Promotion)
                .Where(uc => uc.UserId == userId)
                .OrderByDescending(uc => uc.CreatedAt)
                .ToListAsync();

            return vouchers
                .Where(uc => uc.Promotion != null)
                .Select(uc => new UserCouponDto
                {
                    Id = uc.Id,
                    PromotionId = uc.PromotionId,
                    PromotionName = uc.Promotion.Name,
                    Description = uc.Promotion.Description ?? string.Empty,
                    DiscountType = uc.Promotion.DiscountType.ToString(),
                    DiscountValue = uc.Promotion.DiscountValue,
                    MaxDiscountAmount = uc.Promotion.MaxDiscountAmount,
                    MinOrderValue = uc.Promotion.MinOrderValue,
                    IsUsed = uc.IsUsed,
                    UsedAt = uc.UsedAt,
                    ExpiresAt = uc.ExpiresAt,
                    PromotionEndDate = uc.Promotion.EndDate,
                    IsExpired = (uc.ExpiresAt.HasValue && uc.ExpiresAt < now) || uc.Promotion.EndDate < now,
                    Note = uc.Note,
                    CouponCode = uc.Promotion.CouponCode
                }).ToList();
        }

        public async Task<List<AvailablePromotionDto>> GetApplicableAsync(int userId)
        {
            var context = await BuildContextAsync(userId, null);
            if (!context.CartItems.Any())
                return new List<AvailablePromotionDto>();

            var applicable = await _engine.GetApplicablePromotionsAsync(context);

            return applicable.Select(p => new AvailablePromotionDto
            {
                Id = p.Id,
                Name = p.Name,
                Description = p.Description,
                DiscountType = p.DiscountType.ToString(),
                DiscountValue = p.DiscountValue,
                EndDate = p.EndDate
            }).ToList();
        }
        public async Task<(bool Success, string Message, int StatusCode, object? Data)> GetEligibleProductsAsync(int id)
        {
            var promo = await _db.Promotions
                .Include(p => p.PromotionProducts)
                .Include(p => p.PromotionCategories)
                .Include(p => p.PromotionBrands)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (promo == null)
                return (false, "Không tìm thấy chương trình khuyến mãi", 404, null);

            var query = _db.Products
                .Include(p => p.ProductVariants)
                .Where(p => !p.IsDeleted && p.IsAvailable);

            switch (promo.Scope)
            {
                case PromotionScope.AllShop:
                case PromotionScope.User:
                case PromotionScope.CustomerGroup:
                    break;

                case PromotionScope.Product:
                    var targetProductIds = promo.PromotionProducts
                        .Where(pp => !pp.IsExcluded)
                        .Select(pp => pp.ProductId)
                        .ToList();
                    var excludedProductIds = promo.PromotionProducts
                        .Where(pp => pp.IsExcluded)
                        .Select(pp => pp.ProductId)
                        .ToList();

                    if (targetProductIds.Any())
                        query = query.Where(p => targetProductIds.Contains(p.Id));
                    else if (excludedProductIds.Any())
                        query = query.Where(p => !excludedProductIds.Contains(p.Id));
                    break;

                case PromotionScope.Category:
                    var targetCategoryIds = promo.PromotionCategories
                        .Where(pc => !pc.IsExcluded)
                        .Select(pc => pc.CategoryId)
                        .ToList();
                    var excludedCategoryIds = promo.PromotionCategories
                        .Where(pc => pc.IsExcluded)
                        .Select(pc => pc.CategoryId)
                        .ToList();

                    if (targetCategoryIds.Any())
                        query = query.Where(p => p.CategoryId.HasValue && targetCategoryIds.Contains(p.CategoryId.Value));
                    else if (excludedCategoryIds.Any())
                        query = query.Where(p => !p.CategoryId.HasValue || !excludedCategoryIds.Contains(p.CategoryId.Value));
                    break;

                case PromotionScope.Brand:
                    var targetBrandIds = promo.PromotionBrands
                        .Where(pb => !pb.IsExcluded)
                        .Select(pb => pb.BrandId)
                        .ToList();
                    var excludedBrandIds = promo.PromotionBrands
                        .Where(pb => pb.IsExcluded)
                        .Select(pb => pb.BrandId)
                        .ToList();

                    if (targetBrandIds.Any())
                        query = query.Where(p => p.BrandId.HasValue && targetBrandIds.Contains(p.BrandId.Value));
                    else if (excludedBrandIds.Any())
                        query = query.Where(p => !p.BrandId.HasValue || !excludedBrandIds.Contains(p.BrandId.Value));
                    break;

                default:
                    break;
            }

            var rawList = await query
                .Take(100)
                .Select(p => new
                {
                    id = p.Id,
                    name = p.Name,
                    mainImageUrl = p.MainImageUrl,
                    minPrice = p.ProductVariants.Any() ? p.ProductVariants.Min(v => v.Price) : 0,
                    maxPrice = p.ProductVariants.Any() ? p.ProductVariants.Max(v => v.Price) : 0,
                    inStock = p.ProductVariants.Any(v => v.Stock > 0)
                })
                .ToListAsync();

            var minOrderVal = promo.MinOrderValue;
            var result = rawList
                .Select(p =>
                {
                    var price = p.minPrice > 0 ? p.minPrice : 1;
                    var suggestedQty = minOrderVal > 0 ? (int)Math.Ceiling(minOrderVal / price) : 1;
                    var meetsMinOrderSingle = minOrderVal <= 0 || p.minPrice >= minOrderVal;
                    return new
                    {
                        p.id,
                        p.name,
                        p.mainImageUrl,
                        p.minPrice,
                        p.maxPrice,
                        p.inStock,
                        suggestedQty,
                        meetsMinOrderSingle
                    };
                })
                .OrderByDescending(p => p.meetsMinOrderSingle)
                .ThenByDescending(p => p.minPrice)
                .ToList();

            var data = new
            {
                promotionId = promo.Id,
                promotionName = promo.Name,
                scope = promo.Scope.ToString(),
                isAllShop = promo.Scope == PromotionScope.AllShop || promo.Scope == PromotionScope.User || promo.Scope == PromotionScope.CustomerGroup,
                minOrderValue = promo.MinOrderValue,
                discountType = promo.DiscountType.ToString(),
                discountValue = promo.DiscountValue,
                products = result
            };

            return (true, string.Empty, 200, data);
        }

        public async Task<List<CustomerGroup>> GetCustomerGroupsAsync()
        {
            return await _db.CustomerGroups.AsNoTracking().OrderBy(g => g.MinTotalSpent).ToListAsync();
        }

        public async Task<CustomerGroup> CreateCustomerGroupAsync(CustomerGroup group)
        {
            group.CreatedAt = DateTime.UtcNow;
            _db.CustomerGroups.Add(group);
            await _db.SaveChangesAsync();
            return group;
        }
        private async Task<PromotionContext> BuildContextAsync(int userId, string? couponCode, int? userCouponId = null, decimal? shippingFee = null)
        {
            var user = await _db.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == userId);

            var orderCount = await _db.Orders
                .CountAsync(o => o.UserId == userId &&
                    (o.Status == OrderStatus.Delivered || o.Status == OrderStatus.Paid));

            var cart = await _db.Carts
                .Include(c => c.CartItems)
                    .ThenInclude(ci => ci.Variant)
                    .ThenInclude(v => v!.Product)
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.UserId == userId);

            var cartItems = cart?.CartItems.Select(ci => new PromotionCartItem
            {
                VariantId = ci.VariantId,
                ProductId = ci.Variant!.ProductId,
                CategoryId = ci.Variant.Product?.CategoryId,
                BrandId = ci.Variant.Product?.BrandId,
                Sku = ci.Variant.Sku ?? string.Empty,
                ProductName = ci.Variant.Product?.Name ?? string.Empty,
                UnitPrice = ci.Variant.Price,
                Quantity = ci.Quantity
            }).ToList() ?? new();

            return new PromotionContext
            {
                UserId = userId,
                User = new PromotionUserInfo
                {
                    Id = userId,
                    Email = user?.Email ?? string.Empty,
                    CustomerGroupId = user?.CustomerGroupId,
                    DateOfBirth = user?.DateOfBirth,
                    TotalSpent = user?.TotalSpent ?? 0,
                    PreviousOrderCount = orderCount
                },
                CartItems = cartItems,
                CouponCode = couponCode,
                UserCouponId = userCouponId,
                ShippingFee = shippingFee ?? 0
            };
        }

        private async Task AddScopeRelationsAsync(Models.Promotion.Promotion promo, CreatePromotionRequest req)
        {
            foreach (var pid in req.ProductIds.Distinct())
                _db.PromotionProducts.Add(new PromotionProduct { PromotionId = promo.Id, ProductId = pid });
            foreach (var pid in req.ExcludedProductIds.Distinct())
                _db.PromotionProducts.Add(new PromotionProduct { PromotionId = promo.Id, ProductId = pid, IsExcluded = true });

            foreach (var cid in req.CategoryIds.Distinct())
                _db.PromotionCategories.Add(new PromotionCategory { PromotionId = promo.Id, CategoryId = cid });
            foreach (var cid in req.ExcludedCategoryIds.Distinct())
                _db.PromotionCategories.Add(new PromotionCategory { PromotionId = promo.Id, CategoryId = cid, IsExcluded = true });

            foreach (var bid in req.BrandIds.Distinct())
                _db.PromotionBrands.Add(new PromotionBrand { PromotionId = promo.Id, BrandId = bid });
            foreach (var bid in req.ExcludedBrandIds.Distinct())
                _db.PromotionBrands.Add(new PromotionBrand { PromotionId = promo.Id, BrandId = bid, IsExcluded = true });

            foreach (var gid in req.CustomerGroupIds.Distinct())
                _db.PromotionCustomerGroups.Add(new PromotionCustomerGroup { PromotionId = promo.Id, CustomerGroupId = gid });

            await _db.SaveChangesAsync();
        }

        private static Models.Promotion.Promotion MapFromRequest(CreatePromotionRequest req) => new()
        {
            Name = req.Name.Trim(),
            Description = req.Description,
            BannerUrl = req.BannerUrl,
            Type = req.Type,
            Status = req.Status,
            Priority = req.Priority,
            IsStackable = req.IsStackable,
            MaxStackCount = req.MaxStackCount,
            ExclusiveGroup = req.ExclusiveGroup,
            DiscountType = req.DiscountType,
            DiscountValue = req.DiscountValue,
            MaxDiscountAmount = req.MaxDiscountAmount,
            MinOrderValue = req.MinOrderValue,
            MaxOrderValue = req.MaxOrderValue,
            MinQuantity = req.MinQuantity,
            StartDate = req.StartDate,
            EndDate = req.EndDate,
            UsageLimitTotal = req.UsageLimitTotal,
            UsageLimitPerUser = req.UsageLimitPerUser,
            UsageLimitPerDay = req.UsageLimitPerDay,
            UsageLimitPerMonth = req.UsageLimitPerMonth,
            Scope = req.Scope,
            CouponCode = string.IsNullOrWhiteSpace(req.CouponCode) ? null : req.CouponCode.ToUpper(),
            IsPersonal = req.IsPersonal,
            RequiresNewUser = req.RequiresNewUser,
            RequiresCustomerGroup = req.RequiresCustomerGroup,
            RequiresBirthdayUser = req.RequiresBirthdayUser,
            BuyQuantity = req.BuyQuantity,
            GetQuantity = req.GetQuantity,
            GetProductId = req.GetProductId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        private static void UpdateFromRequest(Models.Promotion.Promotion p, CreatePromotionRequest req)
        {
            p.Name = req.Name.Trim();
            p.Description = req.Description;
            p.BannerUrl = req.BannerUrl;
            p.Type = req.Type;
            p.Status = req.Status;
            p.Priority = req.Priority;
            p.IsStackable = req.IsStackable;
            p.MaxStackCount = req.MaxStackCount;
            p.ExclusiveGroup = req.ExclusiveGroup;
            p.DiscountType = req.DiscountType;
            p.DiscountValue = req.DiscountValue;
            p.MaxDiscountAmount = req.MaxDiscountAmount;
            p.MinOrderValue = req.MinOrderValue;
            p.MaxOrderValue = req.MaxOrderValue;
            p.MinQuantity = req.MinQuantity;
            p.StartDate = req.StartDate;
            p.EndDate = req.EndDate;
            p.UsageLimitTotal = req.UsageLimitTotal;
            p.UsageLimitPerUser = req.UsageLimitPerUser;
            p.UsageLimitPerDay = req.UsageLimitPerDay;
            p.UsageLimitPerMonth = req.UsageLimitPerMonth;
            p.Scope = req.Scope;
            p.CouponCode = string.IsNullOrWhiteSpace(req.CouponCode) ? null : req.CouponCode.ToUpper();
            p.IsPersonal = req.IsPersonal;
            p.RequiresNewUser = req.RequiresNewUser;
            p.RequiresCustomerGroup = req.RequiresCustomerGroup;
            p.RequiresBirthdayUser = req.RequiresBirthdayUser;
            p.BuyQuantity = req.BuyQuantity;
            p.GetQuantity = req.GetQuantity;
            p.GetProductId = req.GetProductId;
            p.UpdatedAt = DateTime.UtcNow;
        }

        private static PromotionDto ToDto(Models.Promotion.Promotion p, DateTime now) => new()
        {
            Id = p.Id,
            Name = p.Name,
            Description = p.Description,
            BannerUrl = p.BannerUrl,
            Type = p.Type.ToString(),
            Status = p.Status.ToString(),
            Priority = p.Priority,
            IsStackable = p.IsStackable,
            MaxStackCount = p.MaxStackCount,
            ExclusiveGroup = p.ExclusiveGroup,
            DiscountType = p.DiscountType.ToString(),
            DiscountValue = p.DiscountValue,
            MaxDiscountAmount = p.MaxDiscountAmount,
            MinOrderValue = p.MinOrderValue,
            MaxOrderValue = p.MaxOrderValue,
            MinQuantity = p.MinQuantity,
            StartDate = p.StartDate,
            EndDate = p.EndDate,
            UsageLimitTotal = p.UsageLimitTotal,
            UsageLimitPerUser = p.UsageLimitPerUser,
            UsageLimitPerDay = p.UsageLimitPerDay,
            UsageLimitPerMonth = p.UsageLimitPerMonth,
            UsedCount = p.UsedCount,
            Scope = p.Scope.ToString(),
            CouponCode = p.CouponCode,
            IsPersonal = p.IsPersonal,
            RequiresNewUser = p.RequiresNewUser,
            RequiresCustomerGroup = p.RequiresCustomerGroup,
            RequiresBirthdayUser = p.RequiresBirthdayUser,
            CreatedAt = p.CreatedAt,
            UpdatedAt = p.UpdatedAt,
            IsActive = p.Status == PromotionStatus.Active && p.StartDate <= now && p.EndDate >= now,
            ProductIds = p.PromotionProducts.Where(x => !x.IsExcluded).Select(x => x.ProductId).ToList(),
            CategoryIds = p.PromotionCategories.Where(x => !x.IsExcluded).Select(x => x.CategoryId).ToList(),
            BrandIds = p.PromotionBrands.Where(x => !x.IsExcluded).Select(x => x.BrandId).ToList(),
            CustomerGroupIds = p.PromotionCustomerGroups.Select(x => x.CustomerGroupId).ToList()
        };

        private void InvalidateCache() => _cache.Remove(CacheKey);
    }
}
