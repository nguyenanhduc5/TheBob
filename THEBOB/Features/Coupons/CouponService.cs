using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using THEBOB.Data;
using THEBOB.Models;
using THEBOB.Exceptions;

namespace THEBOB.Services
{
    public class CouponService : ICouponService
    {
        private readonly ThebobDbContext _context;

        public CouponService(ThebobDbContext context)
        {
            _context = context;
        }

        public async Task<List<object>> GetCouponsAsync()
        {
            var now = DateTime.UtcNow;
            var coupons = await _context.Coupons
                .Include(c => c.Product)
                .Include(c => c.Category)
                .Include(c => c.TargetUser)
                .OrderByDescending(c => c.CreatedAt)
                .Select(c => new
                {
                    c.Id, c.Name, c.Code, c.DiscountType, c.DiscountValue,
                    c.MinOrderValue, c.MaxDiscountAmount,
                    c.StartDate, c.EndDate,
                    c.UsageLimit, c.UsedCount,
                    c.IsAutomatic, c.ProductId, c.CategoryId, c.TargetUserId,
                    ProductName = c.Product != null ? c.Product.Name : null,
                    CategoryName = c.Category != null ? c.Category.Name : null,
                    TargetUserEmail = c.TargetUser != null ? c.TargetUser.Email : null,
                    TargetUserName = c.TargetUser != null ? c.TargetUser.FullName : null,
                    c.CreatedAt, c.UpdatedAt,
                    DiscountPercent = c.DiscountValue,
                    ExpiryDate = c.EndDate,
                    IsActive = now >= c.StartDate && now <= c.EndDate
                                && (c.UsageLimit == 0 || c.UsedCount < c.UsageLimit)
                })
                .ToListAsync();

            return coupons.Cast<object>().ToList();
        }

        public async Task<List<object>> GetAutomaticCouponsAsync()
        {
            var now = DateTime.UtcNow;
            var promos = await _context.Coupons
                .Where(c => c.IsAutomatic
                    && c.StartDate <= now
                    && c.EndDate >= now
                    && (c.UsageLimit == 0 || c.UsedCount < c.UsageLimit))
                .Select(c => new
                {
                    c.Id, c.Name, c.Code, c.DiscountType, c.DiscountValue,
                    c.MinOrderValue, c.MaxDiscountAmount,
                    c.StartDate, c.EndDate,
                    c.ProductId, c.CategoryId,
                    DiscountPercent = c.DiscountValue,
                    ExpiryDate = c.EndDate,
                })
                .ToListAsync();

            return promos.Cast<object>().ToList();
        }

        public async Task<List<object>> GetMyVouchersAsync(int userId)
        {
            var now = DateTime.UtcNow;
            var vouchers = await _context.Coupons
                .Where(c => c.TargetUserId == userId
                    && !c.IsAutomatic
                    && c.EndDate >= now)
                .Select(c => new
                {
                    c.Id, c.Name, c.Code, c.DiscountType, c.DiscountValue,
                    c.MinOrderValue, c.MaxDiscountAmount,
                    c.StartDate, c.EndDate,
                    c.UsageLimit, c.UsedCount,
                    c.ProductId, c.CategoryId,
                    DiscountPercent = c.DiscountValue,
                    ExpiryDate = c.EndDate,
                    IsActive = now >= c.StartDate && now <= c.EndDate
                                && (c.UsageLimit == 0 || c.UsedCount < c.UsageLimit),
                    AlreadyUsed = _context.CouponUsages.Any(u => u.CouponId == c.Id && u.UserId == userId)
                })
                .ToListAsync();

            return vouchers.Cast<object>().ToList();
        }

        public async Task<object> ApplyCouponAsync(int? userId, string code, decimal orderTotal)
        {
            var coupon = await _context.Coupons
                .FirstOrDefaultAsync(c => c.Code.ToUpper() == code.ToUpper() && !c.IsAutomatic);

            if (coupon == null)
                throw new NotFoundException("Mã giảm giá không tồn tại.");

            var now = DateTime.UtcNow;
            if (now < coupon.StartDate)
                throw new BadRequestException("Mã giảm giá chưa bắt đầu áp dụng.");

            if (now > coupon.EndDate)
                throw new BadRequestException("Mã giảm giá đã hết hạn sử dụng.");

            if (coupon.UsageLimit > 0 && coupon.UsedCount >= coupon.UsageLimit)
                throw new ConflictException("Mã giảm giá đã hết lượt sử dụng.");

            if (coupon.MinOrderValue > 0 && orderTotal > 0 && orderTotal < coupon.MinOrderValue)
                throw new BadRequestException($"Đơn hàng tối thiểu {coupon.MinOrderValue:N0} VNĐ để dùng mã này.");

            if (coupon.TargetUserId.HasValue)
            {
                if (!userId.HasValue)
                    throw new UnauthorizedException("Vui lòng đăng nhập để sử dụng mã giảm giá này.");

                if (userId.Value != coupon.TargetUserId.Value)
                    throw new ForbiddenException("Mã giảm giá này không dành cho tài khoản của bạn.");
            }

            if (userId.HasValue)
            {
                bool alreadyUsed = await _context.CouponUsages
                    .AnyAsync(u => u.CouponId == coupon.Id && u.UserId == userId.Value);
                if (alreadyUsed)
                    throw new ConflictException("Bạn đã sử dụng mã giảm giá này rồi.");
            }

            var data = new
            {
                coupon.Id, coupon.Name, coupon.Code,
                coupon.DiscountType, coupon.DiscountValue,
                coupon.MinOrderValue, coupon.MaxDiscountAmount,
                coupon.StartDate, coupon.EndDate,
                coupon.ProductId, coupon.CategoryId,
                DiscountPercent = coupon.DiscountValue,
                ExpiryDate = coupon.EndDate,
            };

            return data;
        }

        public async Task<Coupon> GetByIdAsync(int id)
        {
            return await _context.Coupons
                .Include(c => c.Product)
                .Include(c => c.Category)
                .Include(c => c.TargetUser)
                .FirstOrDefaultAsync(c => c.Id == id)
                ?? throw new NotFoundException($"Không tìm thấy mã giảm giá #{id}.");
        }

        public async Task<Coupon> CreateCouponAsync(Coupon coupon)
        {
            if (!coupon.IsAutomatic)
            {
                if (string.IsNullOrWhiteSpace(coupon.Code))
                    throw new BadRequestException("Mã code không được để trống.");

                var codeUpper = coupon.Code.Trim().ToUpper();
                bool exists = await _context.Coupons.AnyAsync(c => c.Code == codeUpper);
                if (exists)
                    throw new ConflictException("Mã giảm giá đã tồn tại.");

                coupon.Code = codeUpper;
            }
            else
            {
                coupon.Code = $"AUTO_{Guid.NewGuid():N}".Substring(0, 20).ToUpper();
            }

            coupon.UsedCount = 0;
            coupon.CreatedAt = DateTime.UtcNow;
            coupon.UpdatedAt = DateTime.UtcNow;

            _context.Coupons.Add(coupon);
            await _context.SaveChangesAsync();

            if (coupon.TargetUserId.HasValue)
            {
                _context.Notifications.Add(new Notification
                {
                    UserId = coupon.TargetUserId.Value,
                    Message = $"Bạn vừa nhận được voucher giảm giá: {coupon.Code}"
                        + (string.IsNullOrEmpty(coupon.Name) ? "" : $" — {coupon.Name}"),
                    Type = "Info",
                    IsRead = false,
                    CreatedAt = DateTime.UtcNow
                });
                await _context.SaveChangesAsync();
            }

            return coupon;
        }

        public async Task<Coupon> UpdateCouponAsync(int id, Coupon coupon)
        {
            var existing = await _context.Coupons.FindAsync(id)
                ?? throw new NotFoundException($"Không tìm thấy mã giảm giá #{id}.");

            existing.Name = coupon.Name;
            existing.DiscountType = coupon.DiscountType;
            existing.DiscountValue = coupon.DiscountValue;
            existing.MinOrderValue = coupon.MinOrderValue;
            existing.MaxDiscountAmount = coupon.MaxDiscountAmount;
            existing.StartDate = coupon.StartDate;
            existing.EndDate = coupon.EndDate;
            existing.UsageLimit = coupon.UsageLimit;
            existing.IsAutomatic = coupon.IsAutomatic;
            existing.ProductId = coupon.ProductId;
            existing.CategoryId = coupon.CategoryId;
            existing.TargetUserId = coupon.TargetUserId;
            existing.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return existing;
        }

        public async Task DeleteCouponAsync(int id)
        {
            var existing = await _context.Coupons.FindAsync(id)
                ?? throw new NotFoundException($"Không tìm thấy mã giảm giá #{id}.");

            _context.Coupons.Remove(existing);
            await _context.SaveChangesAsync();
        }
    }
}
