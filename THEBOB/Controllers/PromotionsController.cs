using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using System.Security.Claims;
using THEBOB.Data;
using THEBOB.DTOs.Promotion;
using THEBOB.Models;
using THEBOB.Models.Promotion;
using THEBOB.Services.Promotion;

namespace THEBOB.Controllers
{
    [ApiController]
    [Route("api/promotions")]
    public class PromotionsController : ControllerBase
    {
        private readonly ThebobDbContext _db;
        private readonly IPromotionEngine _engine;
        private readonly IMemoryCache _cache;
        private readonly ILogger<PromotionsController> _logger;
        private const string CacheKey = "promotions:active";

        public PromotionsController(
            ThebobDbContext db,
            IPromotionEngine engine,
            IMemoryCache cache,
            ILogger<PromotionsController> logger)
        {
            _db = db;
            _engine = engine;
            _cache = cache;
            _logger = logger;
        }

        private int? GetUserId() =>
            int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

        private bool IsAdmin() => User.IsInRole("Admin");

        // ─────────────────────────────────────────────────────────────────────
        // ADMIN — CRUD
        // ─────────────────────────────────────────────────────────────────────

        /// <summary>GET api/promotions — Admin: lấy tất cả promotions</summary>
        [HttpGet]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetAll(
            [FromQuery] PromotionStatus? status,
            [FromQuery] PromotionType? type,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
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

            return Ok(new { total, page, pageSize, items });
        }

        /// <summary>GET api/promotions/{id} — Admin: lấy chi tiết</summary>
        [HttpGet("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetById(int id)
        {
            var p = await _db.Promotions
                .Include(x => x.PromotionProducts)
                .Include(x => x.PromotionCategories)
                .Include(x => x.PromotionBrands)
                .Include(x => x.PromotionCustomerGroups)
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == id);

            if (p == null) return NotFound(new { message = "Không tìm thấy chương trình khuyến mãi" });

            var now = DateTime.UtcNow;
            return Ok(ToDto(p, now));
        }

        /// <summary>POST api/promotions — Admin: tạo promotion</summary>
        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Create([FromBody] CreatePromotionRequest req)
        {
            // Validate coupon code uniqueness
            if (!string.IsNullOrWhiteSpace(req.CouponCode))
            {
                var code = req.CouponCode.Trim().ToUpper();
                if (await _db.Promotions.AnyAsync(p => p.CouponCode == code))
                    return BadRequest(new { message = "Mã coupon đã tồn tại" });
                req.CouponCode = code;
            }

            var promo = MapFromRequest(req);
            promo.CreatedBy = User.FindFirstValue(ClaimTypes.Email) ?? "admin";
            _db.Promotions.Add(promo);
            await _db.SaveChangesAsync();

            await AddScopeRelationsAsync(promo, req);
            InvalidateCache();

            _logger.LogInformation("Promotion created: {Name} (Id={Id})", promo.Name, promo.Id);
            return CreatedAtAction(nameof(GetById), new { id = promo.Id }, ToDto(promo, DateTime.UtcNow));
        }

        /// <summary>PUT api/promotions/{id} — Admin: cập nhật</summary>
        [HttpPut("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Update(int id, [FromBody] CreatePromotionRequest req)
        {
            var promo = await _db.Promotions
                .Include(p => p.PromotionProducts)
                .Include(p => p.PromotionCategories)
                .Include(p => p.PromotionBrands)
                .Include(p => p.PromotionCustomerGroups)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (promo == null) return NotFound(new { message = "Không tìm thấy chương trình khuyến mãi" });

            // Validate coupon code uniqueness (excluding self)
            if (!string.IsNullOrWhiteSpace(req.CouponCode))
            {
                var code = req.CouponCode.Trim().ToUpper();
                if (await _db.Promotions.AnyAsync(p => p.CouponCode == code && p.Id != id))
                    return BadRequest(new { message = "Mã coupon đã tồn tại" });
                req.CouponCode = code;
            }

            // Update fields
            UpdateFromRequest(promo, req);

            // Re-create scope relations
            _db.RemoveRange(promo.PromotionProducts);
            _db.RemoveRange(promo.PromotionCategories);
            _db.RemoveRange(promo.PromotionBrands);
            _db.RemoveRange(promo.PromotionCustomerGroups);
            await _db.SaveChangesAsync();

            await AddScopeRelationsAsync(promo, req);
            InvalidateCache();

            return Ok(ToDto(promo, DateTime.UtcNow));
        }

        /// <summary>PUT api/promotions/{id}/status — Admin: kích hoạt / tạm dừng</summary>
        [HttpPut("{id}/status")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdatePromotionStatusRequest req)
        {
            var promo = await _db.Promotions.FindAsync(id);
            if (promo == null) return NotFound();

            promo.Status = req.Status;
            promo.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            InvalidateCache();

            return Ok(new { message = $"Đã cập nhật trạng thái thành {req.Status}", status = req.Status.ToString() });
        }

        /// <summary>POST api/promotions/{id}/clone — Admin: copy promotion</summary>
        [HttpPost("{id}/clone")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Clone(int id)
        {
            var original = await _db.Promotions
                .Include(p => p.PromotionProducts)
                .Include(p => p.PromotionCategories)
                .Include(p => p.PromotionBrands)
                .Include(p => p.PromotionCustomerGroups)
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == id);

            if (original == null) return NotFound();

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
                CouponCode = null, // Clone không giữ coupon code cũ
                IsPersonal = original.IsPersonal,
                RequiresNewUser = original.RequiresNewUser,
                RequiresCustomerGroup = original.RequiresCustomerGroup,
                RequiresBirthdayUser = original.RequiresBirthdayUser,
                BuyQuantity = original.BuyQuantity,
                GetQuantity = original.GetQuantity,
                GetProductId = original.GetProductId,
                CreatedBy = User.FindFirstValue(ClaimTypes.Email) ?? "admin",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _db.Promotions.Add(clone);
            await _db.SaveChangesAsync();

            // Clone scope relations
            foreach (var pp in original.PromotionProducts)
                _db.PromotionProducts.Add(new PromotionProduct { PromotionId = clone.Id, ProductId = pp.ProductId, IsExcluded = pp.IsExcluded });
            foreach (var pc in original.PromotionCategories)
                _db.PromotionCategories.Add(new PromotionCategory { PromotionId = clone.Id, CategoryId = pc.CategoryId, IsExcluded = pc.IsExcluded });
            foreach (var pb in original.PromotionBrands)
                _db.PromotionBrands.Add(new PromotionBrand { PromotionId = clone.Id, BrandId = pb.BrandId, IsExcluded = pb.IsExcluded });
            foreach (var pg in original.PromotionCustomerGroups)
                _db.PromotionCustomerGroups.Add(new PromotionCustomerGroup { PromotionId = clone.Id, CustomerGroupId = pg.CustomerGroupId });

            await _db.SaveChangesAsync();
            return Ok(new { message = "Đã clone thành công", id = clone.Id });
        }

        /// <summary>DELETE api/promotions/{id} — Admin: soft-delete</summary>
        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Delete(int id)
        {
            var promo = await _db.Promotions.FindAsync(id);
            if (promo == null) return NotFound();

            bool hasUsages = await _db.PromotionUsages.AnyAsync(u => u.PromotionId == id);
            if (hasUsages)
            {
                promo.Status = PromotionStatus.Ended;
                promo.EndDate = DateTime.UtcNow.AddDays(-1);
                promo.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
                return Ok(new { message = "Chương trình đã được kết thúc (có lịch sử dùng, không xóa vĩnh viễn)" });
            }

            _db.Promotions.Remove(promo);
            await _db.SaveChangesAsync();
            InvalidateCache();

            return NoContent();
        }

        // ─────────────────────────────────────────────────────────────────────
        // ADMIN — STATISTICS
        // ─────────────────────────────────────────────────────────────────────

        /// <summary>GET api/promotions/{id}/stats — Admin: thống kê</summary>
        [HttpGet("{id}/stats")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetStats(int id)
        {
            var promo = await _db.Promotions.FindAsync(id);
            if (promo == null) return NotFound();

            var usages = await _db.PromotionUsages
                .Where(u => u.PromotionId == id && !u.IsRolledBack)
                .ToListAsync();

            return Ok(new PromotionStatsDto
            {
                PromotionId = id,
                Name = promo.Name,
                TotalUsages = usages.Count,
                TotalDiscountGiven = usages.Sum(u => u.DiscountApplied),
                TotalOrders = usages.Select(u => u.OrderId).Distinct().Count()
            });
        }

        /// <summary>GET api/promotions/stats/summary — Admin: tổng hợp</summary>
        [HttpGet("stats/summary")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetStatsSummary()
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

            return Ok(new PromotionStatsSummaryDto
            {
                TotalDiscountGiven = usages.Sum(u => u.DiscountApplied),
                TotalOrdersWithPromotion = usages.Select(u => u.OrderId).Distinct().Count(),
                TopPromotions = topPromos
            });
        }

        /// <summary>GET api/promotions/{id}/usages — Admin: lịch sử dùng</summary>
        [HttpGet("{id}/usages")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetUsages(int id, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
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

            return Ok(new { total, page, pageSize, items });
        }

        // ─────────────────────────────────────────────────────────────────────
        // ADMIN — USER COUPON MANAGEMENT
        // ─────────────────────────────────────────────────────────────────────

        /// <summary>POST api/promotions/send-user-coupon — Admin: gửi voucher cho user</summary>
        [HttpPost("send-user-coupon")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> SendUserCoupon([FromBody] SendUserCouponRequest req)
        {
            var promo = await _db.Promotions.FindAsync(req.PromotionId);
            if (promo == null) return NotFound(new { message = "Không tìm thấy promotion" });

            var user = await _db.Users.FindAsync(req.UserId);
            if (user == null) return NotFound(new { message = "Không tìm thấy người dùng" });

            // Kiểm tra đã gửi chưa
            bool alreadySent = await _db.UserCoupons
                .AnyAsync(uc => uc.PromotionId == req.PromotionId && uc.UserId == req.UserId && !uc.IsUsed);
            if (alreadySent)
                return BadRequest(new { message = "Người dùng đã có voucher này chưa dùng" });

            var userCoupon = new UserCoupon
            {
                PromotionId = req.PromotionId,
                UserId = req.UserId,
                ExpiresAt = req.ExpiresAt,
                Note = req.Note,
                CreatedAt = DateTime.UtcNow
            };
            _db.UserCoupons.Add(userCoupon);

            // Gửi notification
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
            return Ok(new { message = $"Đã gửi voucher đến {user.Email}", userCouponId = userCoupon.Id });
        }

        /// <summary>POST api/promotions/send-bulk-coupon — Admin: gửi hàng loạt</summary>
        [HttpPost("send-bulk-coupon")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> SendBulkCoupon([FromBody] SendBulkCouponRequest req)
        {
            var promo = await _db.Promotions.FindAsync(req.PromotionId);
            if (promo == null) return NotFound(new { message = "Không tìm thấy promotion" });

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
            return Ok(new { message = $"Đã gửi voucher đến {sent} người dùng", sent });
        }

        // ─────────────────────────────────────────────────────────────────────
        // USER — Coupon validate + My vouchers
        // ─────────────────────────────────────────────────────────────────────

        /// <summary>POST api/promotions/validate-coupon — User: kiểm tra mã coupon</summary>
        [HttpPost("validate-coupon")]
        [Authorize]
        public async Task<IActionResult> ValidateCoupon([FromBody] ApplyCouponRequest req)
        {
            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized();

            var context = await BuildContextAsync(userId.Value, null);
            context.CouponCode = req.CouponCode;

            var (isValid, error, promo) = await _engine.ValidateCouponAsync(req.CouponCode, context);
            if (!isValid)
                return Ok(new ValidateCouponResponse { IsValid = false, ErrorMessage = error });

            decimal estimated = 0;
            if (promo != null)
            {
                var result = await _engine.CalculateAsync(context);
                estimated = result.CouponDiscount;
            }

            return Ok(new ValidateCouponResponse
            {
                IsValid = true,
                EstimatedDiscount = estimated,
                Promotion = promo != null ? ToDto(promo, DateTime.UtcNow) : null
            });
        }

        /// <summary>POST api/promotions/calculate — User: tính toàn bộ discount (auto + coupon)</summary>
        [HttpPost("calculate")]
        [Authorize]
        public async Task<IActionResult> CalculatePromotions([FromBody] CalculatePromotionsRequest req)
        {
            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized();

            var context = await BuildContextAsync(userId.Value, req.CouponCode);
            var result = await _engine.CalculateAsync(context);

            return Ok(new
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
            });
        }

        /// <summary>GET api/promotions/my-vouchers — User: danh sách voucher cá nhân</summary>
        [HttpGet("my-vouchers")]
        [Authorize]
        public async Task<IActionResult> GetMyVouchers()
        {
            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized();

            var now = DateTime.UtcNow;
            var vouchers = await _db.UserCoupons
                .Include(uc => uc.Promotion)
                .Where(uc => uc.UserId == userId.Value)
                .OrderByDescending(uc => uc.CreatedAt)
                .ToListAsync();

            return Ok(vouchers.Select(uc => new UserCouponDto
            {
                Id = uc.Id,
                PromotionId = uc.PromotionId,
                PromotionName = uc.Promotion.Name,
                Description = uc.Promotion.Description,
                DiscountType = uc.Promotion.DiscountType.ToString(),
                DiscountValue = uc.Promotion.DiscountValue,
                MaxDiscountAmount = uc.Promotion.MaxDiscountAmount,
                MinOrderValue = uc.Promotion.MinOrderValue,
                IsUsed = uc.IsUsed,
                UsedAt = uc.UsedAt,
                ExpiresAt = uc.ExpiresAt,
                PromotionEndDate = uc.Promotion.EndDate,
                IsExpired = (uc.ExpiresAt.HasValue && uc.ExpiresAt < now) || uc.Promotion.EndDate < now,
                Note = uc.Note
            }));
        }

        /// <summary>GET api/promotions/applicable — User: promotions hợp lệ cho cart</summary>
        [HttpGet("applicable")]
        [Authorize]
        public async Task<IActionResult> GetApplicable()
        {
            var userId = GetUserId();
            if (!userId.HasValue) return Unauthorized();

            var context = await BuildContextAsync(userId.Value, null);
            if (!context.CartItems.Any())
                return Ok(new List<AvailablePromotionDto>());

            var applicable = await _engine.GetApplicablePromotionsAsync(context);

            return Ok(applicable.Select(p => new AvailablePromotionDto
            {
                Id = p.Id,
                Name = p.Name,
                Description = p.Description,
                DiscountType = p.DiscountType.ToString(),
                DiscountValue = p.DiscountValue,
                EndDate = p.EndDate
            }));
        }

        // ─────────────────────────────────────────────────────────────────────
        // CUSTOMER GROUPS
        // ─────────────────────────────────────────────────────────────────────

        [HttpGet("customer-groups")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetCustomerGroups()
        {
            var groups = await _db.CustomerGroups.AsNoTracking().OrderBy(g => g.MinTotalSpent).ToListAsync();
            return Ok(groups);
        }

        [HttpPost("customer-groups")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> CreateCustomerGroup([FromBody] CustomerGroup group)
        {
            group.CreatedAt = DateTime.UtcNow;
            _db.CustomerGroups.Add(group);
            await _db.SaveChangesAsync();
            return Ok(group);
        }

        // ─────────────────────────────────────────────────────────────────────
        // Helpers
        // ─────────────────────────────────────────────────────────────────────

        private async Task<PromotionContext> BuildContextAsync(int userId, string? couponCode)
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
                CouponCode = couponCode
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
