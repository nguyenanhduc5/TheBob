using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using THEBOB.Data;
using THEBOB.Models;

namespace THEBOB.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CategoryController : ControllerBase
    {
        private readonly ThebobDbContext _context;

        public CategoryController(ThebobDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Category>>> GetCategories()
        {
            var categories = await _context.Categories.OrderBy(c => c.Name).ToListAsync();
            return Ok(categories);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Category>> GetCategory(int id)
        {
            var category = await _context.Categories.FindAsync(id);
            if (category == null)
                return NotFound();
            return Ok(category);
        }

        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<Category>> CreateCategory(CategoryRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
                return BadRequest(new { success = false, message = "Tên danh mục là bắt buộc" });

            var category = new Category
            {
                Name = request.Name.Trim(),
                Description = request.Description?.Trim() ?? string.Empty,
                Slug = GenerateSlug(request.Name)
            };

            _context.Categories.Add(category);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetCategory), new { id = category.Id }, category);
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdateCategory(int id, CategoryRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
                return BadRequest(new { success = false, message = "Tên danh mục là bắt buộc" });

            var existingCategory = await _context.Categories.FindAsync(id);
            if (existingCategory == null)
                return NotFound();

            existingCategory.Name = request.Name.Trim();
            existingCategory.Description = request.Description?.Trim() ?? string.Empty;
            existingCategory.Slug = GenerateSlug(request.Name);
            existingCategory.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> DeleteCategory(int id)
        {
            var category = await _context.Categories.FindAsync(id);
            if (category == null)
                return NotFound();

            var hasProducts = await _context.Products.AnyAsync(p => p.CategoryId == id);
            if (hasProducts)
                return BadRequest("Cannot delete category with assigned products.");

            category.IsDeleted = true;
            category.DeletedAt = DateTime.UtcNow;
            category.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return NoContent();
        }

        private string GenerateSlug(string name)
        {
            return name.Trim().ToLower().Replace(' ', '-').Replace("--", "-");
        }

        public class CategoryRequest
        {
            public string Name { get; set; } = string.Empty;
            public string? Description { get; set; }
        }
    }
}
