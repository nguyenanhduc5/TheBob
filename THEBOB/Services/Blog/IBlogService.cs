using THEBOB.DTOs.Blog;
using THEBOB.Models.Blog;

namespace THEBOB.Services.Blog
{
    public interface IBlogService
    {
        // Categories
        Task<List<BlogCategoryDto>> GetCategoriesAsync();
        Task<BlogCategoryDto> CreateCategoryAsync(CreateBlogCategoryRequest request);

        // Blog posts — Admin
        Task<PagedBlogResult> GetAllAsync(int page, int pageSize, string? status, int? categoryId, string? search);
        Task<BlogPostDetailDto?> GetByIdAsync(int id);
        Task<BlogPostDetailDto> CreateAsync(int authorId, CreateBlogPostRequest request);
        Task<BlogPostDetailDto> UpdateAsync(int id, UpdateBlogPostRequest request);
        Task DeleteAsync(int id);

        // Blog posts — Public
        Task<PagedBlogResult> GetPublishedAsync(int page, int pageSize, int? categoryId, string? search);
        Task<BlogPostDetailDto?> GetBySlugAsync(string slug);
        Task<List<BlogPostListItemDto>> GetFeaturedAsync();

        // Click tracking
        Task TrackClickAsync(int blogPostId, int? userId, TrackBlogClickRequest request);

        // Search for attaching to chat
        Task<List<BlogPostListItemDto>> SearchPublishedAsync(string? query, int limit = 10);
    }
}
