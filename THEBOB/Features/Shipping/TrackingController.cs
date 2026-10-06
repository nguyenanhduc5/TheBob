using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.Threading.Tasks;
using THEBOB.Services.Recommendation;

namespace THEBOB.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TrackingController : ControllerBase
    {
        private readonly RecommendationService _recommendationService;

        public TrackingController(RecommendationService recommendationService)
        {
            _recommendationService = recommendationService;
        }

        private int? GetCurrentUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(userIdClaim, out int userId) ? userId : null;
        }

        [HttpPost("view")]
        public async Task<IActionResult> TrackView([FromBody] ViewTrackingRequest request)
        {
            int? userId = GetCurrentUserId();
            int score = request.DurationSeconds > 30 ? 3 : 1; // Boost score if user spends more than 30s
            await _recommendationService.TrackBehaviorAsync(userId, request.SessionId, "VIEW", request.ProductId.ToString(), score);
            return Ok(new { success = true });
        }

        [HttpPost("search")]
        public async Task<IActionResult> TrackSearch([FromBody] SearchTrackingRequest request)
        {
            int? userId = GetCurrentUserId();
            await _recommendationService.TrackBehaviorAsync(userId, request.SessionId, "SEARCH", request.Query, 2);
            return Ok(new { success = true });
        }

        [HttpPost("cart")]
        public async Task<IActionResult> TrackCart([FromBody] CartTrackingRequest request)
        {
            int? userId = GetCurrentUserId();
            int score = request.Action.ToUpper() == "ADD" ? 10 : -10;
            await _recommendationService.TrackBehaviorAsync(userId, request.SessionId, "ADD_TO_CART", request.ProductId.ToString(), score);
            return Ok(new { success = true });
        }
    }

    public class ViewTrackingRequest
    {
        public int ProductId { get; set; }
        public string SessionId { get; set; } = string.Empty;
        public int DurationSeconds { get; set; }
    }

    public class SearchTrackingRequest
    {
        public string Query { get; set; } = string.Empty;
        public string SessionId { get; set; } = string.Empty;
    }

    public class CartTrackingRequest
    {
        public int ProductId { get; set; }
        public string Action { get; set; } = string.Empty; // ADD, REMOVE
        public int Quantity { get; set; }
        public string SessionId { get; set; } = string.Empty;
    }
}
