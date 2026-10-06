using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using THEBOB.Models;
using THEBOB.Services;
using System.Security.Claims;

namespace THEBOB.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class CartController : ControllerBase
    {
        private readonly ICartService _cartService;

        public CartController(ICartService cartService)
        {
            _cartService = cartService;
        }

        [HttpGet]
        public async Task<ActionResult<Cart>> GetCart()
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue) return Unauthorized();

            var cart = await _cartService.GetCartAsync(userId.Value);
            return Ok(cart);
        }

        [HttpPost("add")]
        public async Task<IActionResult> AddToCart([FromBody] AddToCartRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized();

            var (success, message, availableStock, statusCode) = await _cartService.AddToCartAsync(userId.Value, request);
            if (!success)
            {
                if (statusCode == 404)
                    return NotFound(new { success = false, message });
                if (statusCode == 400)
                    return BadRequest(new { success = false, message, availableStock });
                
                return StatusCode(statusCode, new { success = false, message });
            }

            return Ok(new { success = true, message });
        }

        [HttpPost("sync")]
        public async Task<IActionResult> SyncCart([FromBody] SyncCartRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized();

            var result = await _cartService.SyncCartAsync(userId.Value, request);
            return Ok(result);
        }

        [HttpPut("items/{itemId}")]
        public async Task<IActionResult> UpdateCartItem(int itemId, [FromBody] UpdateCartItemRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized();

            var (success, message, availableStock, statusCode) = await _cartService.UpdateCartItemAsync(userId.Value, itemId, request);
            if (!success)
            {
                if (statusCode == 404)
                    return NotFound(new { success = false, message });
                if (statusCode == 400)
                    return BadRequest(new { success = false, message, availableStock });

                return StatusCode(statusCode, new { success = false, message });
            }

            return Ok(new { success = true, message });
        }

        [HttpDelete("items/{itemId}")]
        public async Task<IActionResult> RemoveCartItem(int itemId)
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized();

            var (success, message, statusCode) = await _cartService.RemoveCartItemAsync(userId.Value, itemId);
            if (!success)
            {
                if (statusCode == 404) return NotFound();
                return StatusCode(statusCode, new { message });
            }

            return Ok();
        }

        [HttpDelete]
        public async Task<IActionResult> ClearCart()
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized();

            await _cartService.ClearCartAsync(userId.Value);
            return Ok();
        }

        private int? GetCurrentUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return userIdClaim != null ? int.Parse(userIdClaim) : null;
        }
    }

    public class AddToCartRequest
    {
        public int VariantId { get; set; }
        public int Quantity { get; set; } = 1;
    }

    public class UpdateCartItemRequest
    {
        public int Quantity { get; set; }
    }

    public class SyncCartRequest
    {
        public List<SyncCartItemRequest> Items { get; set; } = new();
    }

    public class SyncCartItemRequest
    {
        public int VariantId { get; set; }
        public int Quantity { get; set; }
    }
}
