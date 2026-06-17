using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using THEBOB.Data;
using THEBOB.Models;

namespace THEBOB.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CouponsController : ControllerBase
    {
        private readonly ThebobDbContext _context;

        public CouponsController(ThebobDbContext context)
        {
            _context = context;
        }

        // GET: api/coupons
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Coupon>>> GetCoupons()
        {
            return Ok(await _context.Coupons
                .OrderByDescending(c => c.CreatedAt)
                .ToListAsync());
        }

        // GET: api/coupons/5
        [HttpGet("{id}")]
        public async Task<ActionResult<Coupon>> GetCoupon(int id)
        {
            var coupon = await _context.Coupons.FindAsync(id);

            if (coupon == null)
            {
                return NotFound(new
                {
                    message = "Không tìm thấy mã giảm giá"
                });
            }

            return Ok(coupon);
        }

        // GET: api/coupons/code/SALE10
        [HttpGet("code/{code}")]
        public async Task<ActionResult<Coupon>> GetByCode(string code)
        {
            var coupon = await _context.Coupons
                .FirstOrDefaultAsync(c => c.Code.ToUpper() == code.ToUpper());

            if (coupon == null)
            {
                return NotFound(new
                {
                    message = "Mã giảm giá không tồn tại"
                });
            }

            if (DateTime.UtcNow < coupon.StartDate)
            {
                return BadRequest(new
                {
                    message = "Mã giảm giá chưa bắt đầu"
                });
            }

            if (DateTime.UtcNow > coupon.EndDate)
            {
                return BadRequest(new
                {
                    message = "Mã giảm giá đã hết hạn"
                });
            }

            if (coupon.UsageLimit > 0 &&
                coupon.UsedCount >= coupon.UsageLimit)
            {
                return BadRequest(new
                {
                    message = "Mã giảm giá đã hết lượt sử dụng"
                });
            }

            return Ok(coupon);
        }

        // POST: api/coupons
        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<Coupon>> Create(Coupon coupon)
        {
            coupon.Code = coupon.Code.ToUpper();

            bool exists = await _context.Coupons
                .AnyAsync(c => c.Code == coupon.Code);

            if (exists)
            {
                return BadRequest(new
                {
                    message = "Mã giảm giá đã tồn tại"
                });
            }

            coupon.CreatedAt = DateTime.UtcNow;
            coupon.UpdatedAt = DateTime.UtcNow;

            _context.Coupons.Add(coupon);
            await _context.SaveChangesAsync();

            return CreatedAtAction(
                nameof(GetCoupon),
                new { id = coupon.Id },
                coupon);
        }

        // PUT: api/coupons/5
        [HttpPut("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Update(int id, Coupon model)
        {
            var coupon = await _context.Coupons.FindAsync(id);

            if (coupon == null)
            {
                return NotFound(new
                {
                    message = "Không tìm thấy mã giảm giá"
                });
            }

            coupon.Code = model.Code.ToUpper();
            coupon.DiscountType = model.DiscountType;
            coupon.DiscountValue = model.DiscountValue;
            coupon.MinOrderValue = model.MinOrderValue;
            coupon.MaxDiscountAmount = model.MaxDiscountAmount;
            coupon.StartDate = model.StartDate;
            coupon.EndDate = model.EndDate;
            coupon.UsageLimit = model.UsageLimit;
            coupon.UsedCount = model.UsedCount;
            coupon.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return Ok(coupon);
        }

        // DELETE: api/coupons/5
        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Delete(int id)
        {
            var coupon = await _context.Coupons.FindAsync(id);

            if (coupon == null)
            {
                return NotFound(new
                {
                    message = "Không tìm thấy mã giảm giá"
                });
            }

            _context.Coupons.Remove(coupon);
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}