using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using THEBOB.Models;
using THEBOB.Services;

namespace THEBOB.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ProductsController : ControllerBase
    {
        private readonly IProductService _productService;

        public ProductsController(IProductService productService)
        {
            _productService = productService;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetProducts()
        {
            var products = await _productService.GetProductsAsync();
            return Ok(products);
        }

        [HttpGet("{identifier}")]
        public async Task<ActionResult<object>> GetProduct(string identifier)
        {
            var result = await _productService.GetProductAsync(identifier);
            if (!result.Success)
            {
                if (result.StatusCode == 404) return NotFound(new { error = result.Message });
                return BadRequest(new { error = result.Message });
            }

            return Ok(result.Data);
        }

        [HttpGet("categories")]
        public async Task<ActionResult<IEnumerable<Category>>> GetCategories()
        {
            return Ok(await _productService.GetCategoriesAsync());
        }

        [HttpGet("brands")]
        public async Task<ActionResult<IEnumerable<Brand>>> GetBrands()
        {
            return Ok(await _productService.GetBrandsAsync());
        }

        [HttpGet("sizes")]
        public async Task<ActionResult<IEnumerable<Size>>> GetSizes()
        {
            return Ok(await _productService.GetSizesAsync());
        }

        [HttpGet("colors")]
        public async Task<ActionResult<IEnumerable<Color>>> GetColors()
        {
            return Ok(await _productService.GetColorsAsync());
        }

        [HttpPost("colors")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<Color>> CreateColor([FromBody] Color color)
        {
            var result = await _productService.CreateColorAsync(color);
            if (!result.Success)
                return BadRequest(new { success = false, message = result.Message });

            return Ok(result.Data);
        }

        [HttpPost("sizes")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<Size>> CreateSize([FromBody] Size size)
        {
            var result = await _productService.CreateSizeAsync(size);
            if (!result.Success)
                return BadRequest(new { success = false, message = result.Message });

            return Ok(result.Data);
        }

        [HttpPut("colors/{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdateColor(int id, [FromBody] Color color)
        {
            var result = await _productService.UpdateColorAsync(id, color);
            if (!result.Success)
            {
                if (result.StatusCode == 404) return NotFound(new { success = false, message = result.Message });
                return BadRequest(new { success = false, message = result.Message });
            }

            return Ok(result.Data);
        }

        [HttpDelete("colors/{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> DeleteColor(int id)
        {
            var result = await _productService.DeleteColorAsync(id);
            if (!result.Success)
            {
                if (result.StatusCode == 404) return NotFound(new { success = false, message = result.Message });
                return BadRequest(new { success = false, message = result.Message });
            }

            return Ok(new { success = true, message = result.Message });
        }

        [HttpPut("sizes/{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdateSize(int id, [FromBody] Size size)
        {
            var result = await _productService.UpdateSizeAsync(id, size);
            if (!result.Success)
            {
                if (result.StatusCode == 404) return NotFound(new { success = false, message = result.Message });
                return BadRequest(new { success = false, message = result.Message });
            }

            return Ok(result.Data);
        }

        [HttpDelete("sizes/{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> DeleteSize(int id)
        {
            var result = await _productService.DeleteSizeAsync(id);
            if (!result.Success)
            {
                if (result.StatusCode == 404) return NotFound(new { success = false, message = result.Message });
                return BadRequest(new { success = false, message = result.Message });
            }

            return Ok(new { success = true, message = result.Message });
        }

        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<object>> CreateProduct([FromBody] ProductCreateRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var result = await _productService.CreateProductAsync(request);
            if (!result.Success)
                return BadRequest(new { message = result.Message });

            return CreatedAtAction(nameof(GetProduct), new { id = ((dynamic)result.Data!).id }, result.Data);
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdateProduct(int id, [FromBody] ProductUpdateRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var result = await _productService.UpdateProductAsync(id, request);
            if (!result.Success)
            {
                if (result.StatusCode == 404) return NotFound();
                return BadRequest(new { message = result.Message });
            }

            return NoContent();
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> DeleteProduct(int id)
        {
            var result = await _productService.DeleteProductAsync(id);
            if (!result.Success)
            {
                if (result.StatusCode == 404) return NotFound();
                return StatusCode(result.StatusCode, new { message = result.Message });
            }

            return NoContent();
        }

        [HttpGet("search")]
        public async Task<ActionResult<IEnumerable<object>>> Search(
            [FromQuery] string? query,
            [FromQuery] int? categoryId,
            [FromQuery] string? color,
            [FromQuery] decimal? minPrice,
            [FromQuery] decimal? maxPrice)
        {
            var products = await _productService.SearchAsync(query, categoryId, color, minPrice, maxPrice);
            return Ok(products);
        }
    }

    public class ProductCreateRequest
    {
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public int? BrandId { get; set; }
        public string? Material { get; set; }
        public string? CareInstructions { get; set; }
        public string? MainImageUrl { get; set; }
        public bool IsFeatured { get; set; }
        public bool IsAvailable { get; set; } = true;
        public int? CategoryId { get; set; }
        public List<string>? ImageUrls { get; set; }
        public List<ColorImageGroupDto>? ColorImages { get; set; }
        public List<VariantItemDto>? Variants { get; set; }
    }

    public class ColorImageGroupDto
    {
        public int? ColorId { get; set; }
        public List<string> ImageUrls { get; set; } = new();
    }

    public class VariantItemDto
    {
        public int? Id { get; set; }
        public int? SizeId { get; set; }
        public int? ColorId { get; set; }
        public decimal Price { get; set; }
        public string? Sku { get; set; }
        public int Stock { get; set; }
        public bool? IsAvailable { get; set; }
        public List<string>? ImageUrls { get; set; }
    }

    public class ProductUpdateRequest : ProductCreateRequest { }
}
