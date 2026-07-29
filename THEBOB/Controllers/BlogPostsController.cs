using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using THEBOB.DTOs.Blog;
using THEBOB.Models;
using THEBOB.Services.Blog;
using THEBOB.Services.Background;

namespace THEBOB.Controllers
{
    [ApiController]
    [Route("api/blog")]
    public class BlogPostsController : ControllerBase
    {
        private readonly IBlogService _blog;
        private readonly ILogger<BlogPostsController> _logger;

        private readonly BlogClickProcessingQueue _blogClickQueue;

        public BlogPostsController(IBlogService blog, ILogger<BlogPostsController> logger, BlogClickProcessingQueue blogClickQueue)
        {
            _blog = blog;
            _logger = logger;
            _blogClickQueue = blogClickQueue;
        }

        // ── Public endpoints ───────────────────────────────────────────────────
        
        // ...

        /// <summary>Ghi nhận click vào bài viết hoặc ProductCard trong bài viết qua High-performance Background Queue.</summary>
        [HttpPost("{id:int}/click")]
        [AllowAnonymous]
        public async Task<IActionResult> TrackClick(int id, [FromBody] TrackBlogClickRequest request)
        {
            var userId = GetCurrentUserId();
            await _blogClickQueue.EnqueueAsync(new BlogClickJob
            {
                BlogPostId = id,
                UserId = userId,
                SessionId = request.SessionId,
                Source = request.Source ?? "Direct",
                ProductId = request.ProductId
            });

            return Ok(ApiResponse<bool>.Ok(true));
        }

        // ── Public endpoints ───────────────────────────────────────────────────

        /// <summary>Danh sách bài viết đã xuất bản (public).</summary>
        [HttpGet]
        [AllowAnonymous]
        public async Task<IActionResult> GetPublished(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 12,
            [FromQuery] int? categoryId = null,
            [FromQuery] string? search = null)
        {
            var result = await _blog.GetPublishedAsync(page, pageSize, categoryId, search);
            return Ok(ApiResponse<PagedBlogResult>.Ok(result));
        }

        /// <summary>Bài viết nổi bật trang chủ (cache 7 phút).</summary>
        [HttpGet("featured")]
        [AllowAnonymous]
        public async Task<IActionResult> GetFeatured()
        {
            var items = await _blog.GetFeaturedAsync();
            return Ok(ApiResponse<List<BlogPostListItemDto>>.Ok(items));
        }

        /// <summary>Chi tiết bài viết theo slug (public).</summary>
        [HttpGet("{slug}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetBySlug(string slug)
        {
            var post = await _blog.GetBySlugAsync(slug);
            if (post == null) return NotFound(ApiResponse<object>.Fail("Không tìm thấy bài viết."));
            return Ok(ApiResponse<BlogPostDetailDto>.Ok(post));
        }

        /// <summary>Danh sách danh mục (public).</summary>
        [HttpGet("categories")]
        [AllowAnonymous]
        public async Task<IActionResult> GetCategories()
        {
            var cats = await _blog.GetCategoriesAsync();
            return Ok(ApiResponse<List<BlogCategoryDto>>.Ok(cats));
        }

        // ── Admin endpoints ────────────────────────────────────────────────────

        /// <summary>Admin: tất cả bài viết (mọi status).</summary>
        [HttpGet("admin/all")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> AdminGetAll(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20,
            [FromQuery] string? status = null,
            [FromQuery] int? categoryId = null,
            [FromQuery] string? search = null)
        {
            var result = await _blog.GetAllAsync(page, pageSize, status, categoryId, search);
            return Ok(ApiResponse<PagedBlogResult>.Ok(result));
        }

        /// <summary>Admin: chi tiết bài viết theo id.</summary>
        [HttpGet("admin/{id:int}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> AdminGetById(int id)
        {
            var post = await _blog.GetByIdAsync(id);
            if (post == null) return NotFound(ApiResponse<object>.Fail("Không tìm thấy bài viết."));
            return Ok(ApiResponse<BlogPostDetailDto>.Ok(post));
        }

        /// <summary>Admin: tạo bài viết mới.</summary>
        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Create([FromBody] CreateBlogPostRequest request)
        {
            var authorId = GetCurrentUserId();
            if (!authorId.HasValue) return Unauthorized();

            try
            {
                var post = await _blog.CreateAsync(authorId.Value, request);
                return CreatedAtAction(nameof(GetBySlug), new { slug = post.Slug },
                    ApiResponse<BlogPostDetailDto>.Ok(post));
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ApiResponse<object>.Fail(ex.Message));
            }
        }

        /// <summary>Admin: cập nhật bài viết.</summary>
        [HttpPut("{id:int}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateBlogPostRequest request)
        {
            try
            {
                var post = await _blog.UpdateAsync(id, request);
                return Ok(ApiResponse<BlogPostDetailDto>.Ok(post));
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ApiResponse<object>.Fail(ex.Message));
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ApiResponse<object>.Fail(ex.Message));
            }
        }

        /// <summary>Admin: xóa mềm (Archive) bài viết.</summary>
        [HttpDelete("{id:int}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                await _blog.DeleteAsync(id);
                return Ok(ApiResponse<bool>.Ok(true));
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ApiResponse<object>.Fail(ex.Message));
            }
        }

        /// <summary>Admin: tạo danh mục.</summary>
        [HttpPost("categories")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> CreateCategory([FromBody] CreateBlogCategoryRequest request)
        {
            var cat = await _blog.CreateCategoryAsync(request);
            return Ok(ApiResponse<BlogCategoryDto>.Ok(cat));
        }

        /// <summary>Admin: tìm kiếm bài viết đã xuất bản để đính kèm vào chat.</summary>
        [HttpGet("admin/search-posts")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> SearchPosts([FromQuery] string? q = null, [FromQuery] int limit = 10)
        {
            var items = await _blog.SearchPublishedAsync(q, limit);
            return Ok(ApiResponse<List<BlogPostListItemDto>>.Ok(items));
        }



        private int? GetCurrentUserId()
        {
            var sub = User.FindFirst("sub")?.Value
                   ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(sub, out var id) ? id : null;
        }
    }
}
