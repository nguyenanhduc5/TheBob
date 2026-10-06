using THEBOB.Models.Blog;

namespace THEBOB.DTOs.Blog
{
    // ── Blog Category ──────────────────────────────────────────────────────────

    public class BlogCategoryDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Slug { get; set; } = string.Empty;
        public string? Description { get; set; }
    }

    public class CreateBlogCategoryRequest
    {
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
    }

    // ── Blog Post List / Detail ────────────────────────────────────────────────

    public class BlogPostListItemDto
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Slug { get; set; } = string.Empty;
        public string? Summary { get; set; }
        public string? Thumbnail { get; set; }
        public string? CategoryName { get; set; }
        public int? CategoryId { get; set; }
        public string Status { get; set; } = string.Empty;
        public bool IsFeaturedHome { get; set; }
        public int HomeDisplayOrder { get; set; }
        public string? AuthorName { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? PublishedAt { get; set; }
    }

    public class BlogProductRef
    {
        public int ProductId { get; set; }
        public string? Name { get; set; }
        public string? Thumbnail { get; set; }
        public decimal Price { get; set; }
        public int DisplayOrder { get; set; }
    }

    public class BlogPostDetailDto
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Slug { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public string? Summary { get; set; }
        public string? Thumbnail { get; set; }
        public int? CategoryId { get; set; }
        public string? CategoryName { get; set; }
        public string Status { get; set; } = string.Empty;
        public bool IsFeaturedHome { get; set; }
        public int HomeDisplayOrder { get; set; }
        public string? AuthorName { get; set; }
        public int AuthorId { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public DateTime? PublishedAt { get; set; }
        public List<BlogProductRef> Products { get; set; } = new();
    }

    public class CreateBlogPostRequest
    {
        public string Title { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public string? Summary { get; set; }
        public string? Thumbnail { get; set; }
        public int? CategoryId { get; set; }
        public string Status { get; set; } = "Draft";
        public bool IsFeaturedHome { get; set; } = false;
        public int HomeDisplayOrder { get; set; } = 0;
        /// <summary>Danh sách sản phẩm đính kèm (id + display order).</summary>
        public List<BlogProductAttachRequest> Products { get; set; } = new();
    }

    public class UpdateBlogPostRequest : CreateBlogPostRequest { }

    public class BlogProductAttachRequest
    {
        public int ProductId { get; set; }
        public int DisplayOrder { get; set; } = 0;
    }

    // ── Track Click ────────────────────────────────────────────────────────────

    public class TrackBlogClickRequest
    {
        public string Source { get; set; } = "Direct";
        public int? ProductId { get; set; }
        public string? SessionId { get; set; }
    }

    // ── Blog Notification ──────────────────────────────────────────────────────

    public class SendBlogNotificationRequest
    {
        public int? BlogPostId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? Body { get; set; }
        /// <summary>All | Segment | Manual</summary>
        public string TargetType { get; set; } = "All";
        /// <summary>Khi TargetType=Manual: danh sách userId cụ thể.</summary>
        public List<int> UserIds { get; set; } = new();
        /// <summary>Khi TargetType=Segment: config JSON (minOrders, tier v.v.).</summary>
        public string? SegmentConfig { get; set; }
    }

    public class BlogNotificationDto
    {
        public int Id { get; set; }
        public int BlogNotificationId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? Body { get; set; }
        public int? BlogPostId { get; set; }
        public string? BlogPostSlug { get; set; }
        public string? BlogPostThumbnail { get; set; }
        public bool IsRead { get; set; }
        public DateTime SentAt { get; set; }
    }

    // ── Send Blog Post In Chat ─────────────────────────────────────────────────

    public class SendBlogPostInChatRequest
    {
        public int ConversationId { get; set; }
        public int BlogPostId { get; set; }
    }

    // ── Paged Result ──────────────────────────────────────────────────────────

    public class PagedBlogResult
    {
        public List<BlogPostListItemDto> Items { get; set; } = new();
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int TotalCount { get; set; }
        public bool HasMore { get; set; }
    }
}
