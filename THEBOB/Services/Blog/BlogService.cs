using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using System.Text;
using System.Text.RegularExpressions;
using THEBOB.Data;
using THEBOB.DTOs.Blog;
using THEBOB.Models.Blog;

namespace THEBOB.Services.Blog
{
    public class BlogService : IBlogService
    {
        private readonly ThebobDbContext _db;
        private readonly IMemoryCache _cache;
        private const string FeaturedCacheKey = "blog:featured";
        private static readonly TimeSpan FeaturedCacheDuration = TimeSpan.FromMinutes(7);

        public BlogService(ThebobDbContext db, IMemoryCache cache)
        {
            _db = db;
            _cache = cache;
        }

        // ── Slug helper ────────────────────────────────────────────────────────

        public static string GenerateSlug(string title)
        {
            if (string.IsNullOrWhiteSpace(title)) return Guid.NewGuid().ToString("N")[..8];

            // Chuẩn hóa Unicode → NFD rồi loại bỏ diacritics
            var normalized = title.Normalize(NormalizationForm.FormD);
            var sb = new StringBuilder();
            foreach (var c in normalized)
            {
                var cat = System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c);
                if (cat != System.Globalization.UnicodeCategory.NonSpacingMark)
                    sb.Append(c);
            }

            var ascii = sb.ToString().Normalize(NormalizationForm.FormC).ToLowerInvariant();
            // Thay thế ký tự đặc biệt tiếng Việt còn sót
            ascii = ascii.Replace("đ", "d").Replace("Đ", "d");
            // Chỉ giữ ký tự [a-z0-9]
            ascii = Regex.Replace(ascii, @"[^a-z0-9\s-]", "");
            // Thay khoảng trắng bằng dấu gạch ngang
            ascii = Regex.Replace(ascii, @"\s+", "-").Trim('-');
            // Loại bỏ dấu gạch ngang liên tiếp
            ascii = Regex.Replace(ascii, @"-{2,}", "-");

            return string.IsNullOrEmpty(ascii) ? Guid.NewGuid().ToString("N")[..8] : ascii;
        }

        private async Task<string> EnsureUniqueSlugAsync(string baseSlug, int? excludeId = null)
        {
            var slug = baseSlug;
            var suffix = 1;
            while (true)
            {
                var exists = await _db.BlogPosts
                    .AnyAsync(b => b.Slug == slug && (excludeId == null || b.Id != excludeId));
                if (!exists) return slug;
                slug = $"{baseSlug}-{suffix++}";
            }
        }

        // ── Mapping helpers ────────────────────────────────────────────────────

        private static BlogPostListItemDto ToListItem(Models.Blog.BlogPost p) => new()
        {
            Id = p.Id,
            Title = p.Title,
            Slug = p.Slug,
            Summary = p.Summary,
            Thumbnail = p.Thumbnail,
            CategoryId = p.CategoryId,
            CategoryName = p.Category?.Name,
            Status = p.Status.ToString(),
            IsFeaturedHome = p.IsFeaturedHome,
            HomeDisplayOrder = p.HomeDisplayOrder,
            AuthorName = p.Author?.FullName,
            CreatedAt = p.CreatedAt,
            PublishedAt = p.PublishedAt,
        };

        private static BlogPostDetailDto ToDetail(Models.Blog.BlogPost p) => new()
        {
            Id = p.Id,
            Title = p.Title,
            Slug = p.Slug,
            Content = p.Content,
            Summary = p.Summary,
            Thumbnail = p.Thumbnail,
            CategoryId = p.CategoryId,
            CategoryName = p.Category?.Name,
            Status = p.Status.ToString(),
            IsFeaturedHome = p.IsFeaturedHome,
            HomeDisplayOrder = p.HomeDisplayOrder,
            AuthorId = p.AuthorId,
            AuthorName = p.Author?.FullName,
            CreatedAt = p.CreatedAt,
            UpdatedAt = p.UpdatedAt,
            PublishedAt = p.PublishedAt,
            Products = p.BlogPostProducts
                .OrderBy(bp => bp.DisplayOrder)
                .Select(bp => new BlogProductRef
                {
                    ProductId = bp.ProductId,
                    Name = bp.Product?.Name,
                    Thumbnail = bp.Product?.MainImageUrl,
                    Price = bp.Product?.ProductVariants?.Any() == true
                        ? bp.Product.ProductVariants.Min(v => v.Price)
                        : 0,
                    DisplayOrder = bp.DisplayOrder
                }).ToList()
        };

        // ── Categories ─────────────────────────────────────────────────────────

        public async Task<List<BlogCategoryDto>> GetCategoriesAsync()
        {
            return await _db.BlogCategories
                .OrderBy(c => c.Name)
                .Select(c => new BlogCategoryDto
                {
                    Id = c.Id,
                    Name = c.Name,
                    Slug = c.Slug,
                    Description = c.Description,
                })
                .ToListAsync();
        }

        public async Task<BlogCategoryDto> CreateCategoryAsync(CreateBlogCategoryRequest request)
        {
            var slug = await EnsureCategorySlugAsync(GenerateSlug(request.Name));
            var cat = new BlogCategory
            {
                Name = request.Name.Trim(),
                Slug = slug,
                Description = request.Description?.Trim(),
            };
            _db.BlogCategories.Add(cat);
            await _db.SaveChangesAsync();
            return new BlogCategoryDto { Id = cat.Id, Name = cat.Name, Slug = cat.Slug, Description = cat.Description };
        }

        private async Task<string> EnsureCategorySlugAsync(string baseSlug)
        {
            var slug = baseSlug;
            var suffix = 1;
            while (await _db.BlogCategories.AnyAsync(c => c.Slug == slug))
                slug = $"{baseSlug}-{suffix++}";
            return slug;
        }

        // ── Admin CRUD ────────────────────────────────────────────────────────

        public async Task<PagedBlogResult> GetAllAsync(int page, int pageSize, string? status, int? categoryId, string? search)
        {
            var q = _db.BlogPosts
                .Include(p => p.Category)
                .Include(p => p.Author)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<BlogStatus>(status, out var st))
                q = q.Where(p => p.Status == st);
            if (categoryId.HasValue)
                q = q.Where(p => p.CategoryId == categoryId);
            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.ToLower();
                q = q.Where(p => p.Title.ToLower().Contains(s) || (p.Summary != null && p.Summary.ToLower().Contains(s)));
            }

            var total = await q.CountAsync();
            var items = await q
                .OrderByDescending(p => p.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return new PagedBlogResult
            {
                Items = items.Select(ToListItem).ToList(),
                Page = page,
                PageSize = pageSize,
                TotalCount = total,
                HasMore = page * pageSize < total,
            };
        }

        public async Task<BlogPostDetailDto?> GetByIdAsync(int id)
        {
            var p = await _db.BlogPosts
                .Include(x => x.Category)
                .Include(x => x.Author)
                .Include(x => x.BlogPostProducts).ThenInclude(bp => bp.Product).ThenInclude(pr => pr.ProductVariants)
                .FirstOrDefaultAsync(x => x.Id == id);
            return p == null ? null : ToDetail(p);
        }

        public async Task<BlogPostDetailDto> CreateAsync(int authorId, CreateBlogPostRequest request)
        {
            var status = Enum.TryParse<BlogStatus>(request.Status, out var st) ? st : BlogStatus.Draft;

            // Validate khi Publish
            if (status == BlogStatus.Published)
                ValidateBeforePublish(request.Content, request.Products, request.Title);

            var baseSlug = GenerateSlug(request.Title);
            var slug = await EnsureUniqueSlugAsync(baseSlug);

            var post = new Models.Blog.BlogPost
            {
                Title = request.Title.Trim(),
                Slug = slug,
                Content = request.Content,
                Summary = request.Summary?.Trim(),
                Thumbnail = request.Thumbnail?.Trim(),
                CategoryId = request.CategoryId,
                AuthorId = authorId,
                Status = status,
                IsFeaturedHome = request.IsFeaturedHome,
                HomeDisplayOrder = request.HomeDisplayOrder,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                PublishedAt = status == BlogStatus.Published ? DateTime.UtcNow : null,
            };

            _db.BlogPosts.Add(post);
            await _db.SaveChangesAsync();

            // Gắn sản phẩm
            foreach (var prod in request.Products)
            {
                _db.BlogPostProducts.Add(new BlogPostProduct
                {
                    BlogPostId = post.Id,
                    ProductId = prod.ProductId,
                    DisplayOrder = prod.DisplayOrder,
                });
            }
            await _db.SaveChangesAsync();
            _cache.Remove(FeaturedCacheKey);

            return (await GetByIdAsync(post.Id))!;
        }

        public async Task<BlogPostDetailDto> UpdateAsync(int id, UpdateBlogPostRequest request)
        {
            var post = await _db.BlogPosts
                .Include(p => p.BlogPostProducts)
                .FirstOrDefaultAsync(p => p.Id == id)
                ?? throw new KeyNotFoundException($"BlogPost {id} không tồn tại.");

            var status = Enum.TryParse<BlogStatus>(request.Status, out var st) ? st : BlogStatus.Draft;
            if (status == BlogStatus.Published)
                ValidateBeforePublish(request.Content, request.Products, request.Title);

            // Nếu title thay đổi, tạo slug mới
            if (!string.Equals(post.Title, request.Title.Trim(), StringComparison.OrdinalIgnoreCase))
            {
                var baseSlug = GenerateSlug(request.Title);
                post.Slug = await EnsureUniqueSlugAsync(baseSlug, excludeId: id);
            }

            post.Title = request.Title.Trim();
            post.Content = request.Content;
            post.Summary = request.Summary?.Trim();
            post.Thumbnail = request.Thumbnail?.Trim();
            post.CategoryId = request.CategoryId;
            post.Status = status;
            post.IsFeaturedHome = request.IsFeaturedHome;
            post.HomeDisplayOrder = request.HomeDisplayOrder;
            post.UpdatedAt = DateTime.UtcNow;

            if (status == BlogStatus.Published && post.PublishedAt == null)
                post.PublishedAt = DateTime.UtcNow;

            // Cập nhật sản phẩm đính kèm
            _db.BlogPostProducts.RemoveRange(post.BlogPostProducts);
            foreach (var prod in request.Products)
            {
                _db.BlogPostProducts.Add(new BlogPostProduct
                {
                    BlogPostId = post.Id,
                    ProductId = prod.ProductId,
                    DisplayOrder = prod.DisplayOrder,
                });
            }

            await _db.SaveChangesAsync();
            _cache.Remove(FeaturedCacheKey);
            return (await GetByIdAsync(id))!;
        }

        public async Task DeleteAsync(int id)
        {
            var post = await _db.BlogPosts.FindAsync(id)
                ?? throw new KeyNotFoundException($"BlogPost {id} không tồn tại.");
            post.Status = BlogStatus.Archived;
            post.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            _cache.Remove(FeaturedCacheKey);
        }

        // ── Public ────────────────────────────────────────────────────────────

        public async Task<PagedBlogResult> GetPublishedAsync(int page, int pageSize, int? categoryId, string? search)
        {
            var q = _db.BlogPosts
                .Include(p => p.Category)
                .Include(p => p.Author)
                .Where(p => p.Status == BlogStatus.Published)
                .AsQueryable();

            if (categoryId.HasValue)
                q = q.Where(p => p.CategoryId == categoryId);
            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.ToLower();
                q = q.Where(p => p.Title.ToLower().Contains(s) || (p.Summary != null && p.Summary.ToLower().Contains(s)));
            }

            var total = await q.CountAsync();
            var items = await q
                .OrderByDescending(p => p.PublishedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return new PagedBlogResult
            {
                Items = items.Select(ToListItem).ToList(),
                Page = page,
                PageSize = pageSize,
                TotalCount = total,
                HasMore = page * pageSize < total,
            };
        }

        public async Task<BlogPostDetailDto?> GetBySlugAsync(string slug)
        {
            var p = await _db.BlogPosts
                .Include(x => x.Category)
                .Include(x => x.Author)
                .Include(x => x.BlogPostProducts)
                    .ThenInclude(bp => bp.Product)
                    .ThenInclude(pr => pr.ProductVariants)
                .FirstOrDefaultAsync(x => x.Slug == slug && x.Status == BlogStatus.Published);
            return p == null ? null : ToDetail(p);
        }

        public async Task<List<BlogPostListItemDto>> GetFeaturedAsync()
        {
            if (_cache.TryGetValue(FeaturedCacheKey, out List<BlogPostListItemDto>? cached) && cached != null)
                return cached;

            var items = await _db.BlogPosts
                .Include(p => p.Category)
                .Include(p => p.Author)
                .Where(p => p.Status == BlogStatus.Published && p.IsFeaturedHome)
                .OrderBy(p => p.HomeDisplayOrder)
                .Take(6)
                .ToListAsync();

            var result = items.Select(ToListItem).ToList();
            _cache.Set(FeaturedCacheKey, result, FeaturedCacheDuration);
            return result;
        }

        public async Task<List<BlogPostListItemDto>> SearchPublishedAsync(string? query, int limit = 10)
        {
            var q = _db.BlogPosts
                .Include(p => p.Category)
                .Include(p => p.Author)
                .Where(p => p.Status == BlogStatus.Published);

            if (!string.IsNullOrWhiteSpace(query))
            {
                var lower = query.ToLower();
                q = q.Where(p => p.Title.ToLower().Contains(lower));
            }

            var items = await q
                .OrderByDescending(p => p.PublishedAt)
                .Take(limit)
                .ToListAsync();

            return items.Select(ToListItem).ToList();
        }

        // ── Click tracking ────────────────────────────────────────────────────

        public async Task TrackClickAsync(int blogPostId, int? userId, TrackBlogClickRequest request)
        {
            var source = Enum.TryParse<BlogClickSource>(request.Source, out var s) ? s : BlogClickSource.Direct;
            _db.BlogPostClicks.Add(new BlogPostClick
            {
                BlogPostId = blogPostId,
                UserId = userId,
                SessionId = request.SessionId,
                Source = source,
                ProductId = request.ProductId,
                ClickedAt = DateTime.UtcNow,
            });
            await _db.SaveChangesAsync();
        }

        // ── Validation ────────────────────────────────────────────────────────

        private static void ValidateBeforePublish(string content, List<BlogProductAttachRequest> products, string title)
        {
            if (string.IsNullOrWhiteSpace(title))
                throw new InvalidOperationException("Không thể Publish: Tiêu đề không được để trống.");
            if (string.IsNullOrWhiteSpace(content))
                throw new InvalidOperationException("Không thể Publish: Nội dung không được để trống.");

            var attachedIds = products.Select(p => p.ProductId).ToHashSet();
            var placeholderMatches = System.Text.RegularExpressions.Regex.Matches(content, @"\[product:(\d+)\]");
            var missingIds = new List<int>();

            foreach (System.Text.RegularExpressions.Match m in placeholderMatches)
            {
                if (int.TryParse(m.Groups[1].Value, out var pid) && !attachedIds.Contains(pid))
                    missingIds.Add(pid);
            }

            if (missingIds.Any())
                throw new InvalidOperationException(
                    $"Không thể Publish: Các sản phẩm trong Content chưa được đính kèm: {string.Join(", ", missingIds.Select(i => $"[product:{i}]"))}. Vui lòng gắn sản phẩm hoặc xóa placeholder.");
        }
    }
}
