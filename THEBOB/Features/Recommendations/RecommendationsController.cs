using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Hosting;
using System.Security.Claims;
using THEBOB.Models;
using THEBOB.Services.Recommendation;

namespace THEBOB.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class RecommendationsController : ControllerBase
    {
        private readonly RecommendationService _recommendationService;
        private readonly IHostedService _backgroundMiningService;

        public RecommendationsController(
            RecommendationService recommendationService,
            IEnumerable<IHostedService> hostedServices)
        {
            _recommendationService = recommendationService;
            // Get the hosted service instance to trigger manual mining
            _backgroundMiningService = hostedServices.FirstOrDefault(s => s is RecommendationBackgroundService)!;
        }

        [HttpGet("related")]
        public async Task<IActionResult> GetRelated(int productId, int limit = 5)
        {
            var products = await _recommendationService.GetRelatedProductsAsync(productId, limit);
            return Ok(products.Select(ToProductDto));
        }

        [HttpGet("frequently-bought")]
        public async Task<IActionResult> GetFrequentlyBought(string productIds, int limit = 3)
        {
            if (string.IsNullOrWhiteSpace(productIds))
            {
                return BadRequest("productIds is required.");
            }

            var ids = productIds.Split(',')
                .Select(s => int.TryParse(s, out var id) ? id : 0)
                .Where(id => id > 0)
                .ToList();

            if (!ids.Any()) return Ok(new List<object>());

            var products = await _recommendationService.GetFrequentlyBoughtTogetherAsync(ids, limit);
            return Ok(products.Select(ToProductDto));
        }

        [HttpGet("personalized")]
        public async Task<IActionResult> GetPersonalized(int limit = 10)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (int.TryParse(userIdClaim, out int userId))
            {
                var products = await _recommendationService.GetPersonalizedRecommendationsAsync(userId, limit);
                return Ok(products.Select(ToProductDto));
            }

            // Fallback to trending for anonymous users
            var trending = await _recommendationService.GetTrendingProductsAsync(limit);
            return Ok(trending.Select(ToProductDto));
        }

        [HttpGet("trending")]
        public async Task<IActionResult> GetTrending(int limit = 8)
        {
            var products = await _recommendationService.GetTrendingProductsAsync(limit);
            return Ok(products.Select(ToProductDto));
        }

        [HttpPost("mine")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> TriggerMining()
        {
            if (_backgroundMiningService is RecommendationBackgroundService service)
            {
                // Run mining asynchronously to avoid blocking the API call
                _ = Task.Run(async () =>
                {
                    try
                    {
                        await service.RunMiningAsync();
                    }
                    catch
                    {
                        // Logged inside the background service
                    }
                });

                return Ok(new { message = "Data mining triggered successfully. Check logs for progress." });
            }
            return StatusCode(500, "Background service not available.");
        }

        private static object ToProductDto(Product p)
        {
            var activeVariants = p.ProductVariants.Where(v => !v.IsDeleted).ToList();
            var minPrice = activeVariants.Count == 0 ? 0 : activeVariants.Min(v => v.Price);

            return new
            {
                id = p.Id,
                name = p.Name,
                sku = activeVariants.FirstOrDefault()?.Sku ?? string.Empty,
                description = p.Description,
                brandId = p.BrandId,
                brand = p.Brand?.Name ?? string.Empty,
                material = p.Material,
                careInstructions = p.CareInstructions,
                mainImageUrl = p.MainImageUrl,
                minPrice,
                maxPrice = activeVariants.Count == 0 ? 0 : activeVariants.Max(v => v.Price),
                price = minPrice,
                totalStock = activeVariants.Sum(v => v.Stock),
                stock = activeVariants.Sum(v => v.Stock),
                rating = p.Rating,
                reviewCount = p.ReviewCount,
                images = p.Images.OrderBy(i => i.SortOrder).Select(i => new { i.Id, url = i.Url, i.SortOrder }),
                variants = activeVariants.Select(v => new
                {
                    v.Id,
                    v.SizeId,
                    size = v.Size?.Name ?? string.Empty,
                    v.ColorId,
                    color = v.Color?.Name ?? string.Empty,
                    hexCode = v.Color?.HexCode ?? string.Empty,
                    v.Price,
                    v.Sku,
                    v.Stock,
                    v.IsAvailable,
                    images = v.Images.OrderBy(i => i.SortOrder).Select(i => new { i.Id, url = i.Url, i.SortOrder })
                })
            };
        }
    }
}
