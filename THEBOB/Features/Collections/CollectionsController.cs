using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using THEBOB.Data;
using THEBOB.Features.Collections.DTOs;
using THEBOB.Helpers;
using THEBOB.Models;

namespace THEBOB.Controllers
{
    [ApiController]
    [Route("api/collections")]
    public class CollectionsController : ControllerBase
    {
        private readonly ThebobDbContext _context;

        public CollectionsController(ThebobDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetCollections()
        {
            var collections = await _context.Collections
                .AsNoTracking()
                .Where(collection => collection.IsActive)
                .OrderBy(collection => collection.SortOrder)
                .ThenByDescending(collection => collection.CreatedAt)
                .Select(collection => new
                {
                    collection.Id,
                    collection.Name,
                    collection.Slug,
                    collection.Subtitle,
                    collection.Description,
                    collection.ImageUrl,
                    collection.SortOrder,
                    productCount = collection.ProductCollections.Count(item => item.Product != null && item.Product.IsAvailable)
                })
                .ToListAsync();

            return Ok(collections);
        }

        [HttpGet("admin")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetAdminCollections()
        {
            var collections = await _context.Collections
                .AsNoTracking()
                .OrderBy(collection => collection.SortOrder)
                .ThenByDescending(collection => collection.CreatedAt)
                .Select(collection => new
                {
                    collection.Id,
                    collection.Name,
                    collection.Slug,
                    collection.Subtitle,
                    collection.Description,
                    collection.ImageUrl,
                    collection.IsActive,
                    collection.SortOrder,
                    productIds = collection.ProductCollections
                        .OrderBy(item => item.SortOrder)
                        .Select(item => item.ProductId),
                    productCount = collection.ProductCollections.Count()
                })
                .ToListAsync();

            return Ok(collections);
        }

        [HttpGet("layout")]
        public async Task<IActionResult> GetCollectionLayout()
        {
            var layoutMode = await _context.CollectionDisplaySettings
                .AsNoTracking()
                .Where(setting => setting.Id == 1)
                .Select(setting => setting.LayoutMode)
                .FirstOrDefaultAsync() ?? CollectionLayoutModes.Staggered;

            return Ok(new { layoutMode });
        }

        [HttpPut("layout")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdateCollectionLayout([FromBody] CollectionLayoutRequest request)
        {
            var layoutMode = request.LayoutMode?.Trim().ToLowerInvariant();
            if (!CollectionLayoutModes.IsSupported(layoutMode))
                return BadRequest(new { message = "Kiểu hiển thị bộ sưu tập không hợp lệ." });

            var setting = await _context.CollectionDisplaySettings
                .FirstOrDefaultAsync(item => item.Id == 1);

            if (setting == null)
            {
                setting = new CollectionDisplaySetting { Id = 1 };
                _context.CollectionDisplaySettings.Add(setting);
            }

            setting.LayoutMode = layoutMode!;
            setting.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new { setting.LayoutMode });
        }

        [HttpGet("{identifier}")]
        public async Task<IActionResult> GetCollection(string identifier)
        {
            var query = CollectionDetailsQuery().Where(collection => collection.IsActive);
            Collection? collection = null;

            if (int.TryParse(identifier, out var id) && id > 0)
                collection = await query.FirstOrDefaultAsync(item => item.Id == id);

            collection ??= await query.FirstOrDefaultAsync(item => item.Slug == identifier.ToLower());
            if (collection == null)
                return NotFound(new { message = "Không tìm thấy bộ sưu tập." });

            var products = collection.ProductCollections
                .Where(item => item.Product?.IsAvailable == true)
                .OrderBy(item => item.SortOrder)
                .Select(item => ToProductDto(item.Product!))
                .ToList();

            return Ok(new
            {
                collection.Id,
                collection.Name,
                collection.Slug,
                collection.Subtitle,
                collection.Description,
                collection.ImageUrl,
                collection.SortOrder,
                products
            });
        }

        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> CreateCollection([FromBody] CollectionRequest request)
        {
            var validation = await ValidateRequestAsync(request);
            if (validation != null) return BadRequest(new { message = validation });

            var collection = new Collection
            {
                Name = request.Name.Trim(),
                Slug = await CreateUniqueSlugAsync(request.Name),
                Subtitle = request.Subtitle?.Trim() ?? string.Empty,
                Description = request.Description?.Trim() ?? string.Empty,
                ImageUrl = request.ImageUrl?.Trim() ?? string.Empty,
                IsActive = request.IsActive,
                SortOrder = request.SortOrder,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            SetProducts(collection, request.ProductIds);
            _context.Collections.Add(collection);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetCollection), new { identifier = collection.Slug }, new
            {
                collection.Id,
                collection.Name,
                collection.Slug
            });
        }

        [HttpPut("{id:int}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdateCollection(int id, [FromBody] CollectionRequest request)
        {
            var collection = await _context.Collections
                .Include(item => item.ProductCollections)
                .FirstOrDefaultAsync(item => item.Id == id);
            if (collection == null)
                return NotFound(new { message = "Không tìm thấy bộ sưu tập." });

            var validation = await ValidateRequestAsync(request);
            if (validation != null) return BadRequest(new { message = validation });

            collection.Name = request.Name.Trim();
            collection.Slug = await CreateUniqueSlugAsync(request.Name, id);
            collection.Subtitle = request.Subtitle?.Trim() ?? string.Empty;
            collection.Description = request.Description?.Trim() ?? string.Empty;
            collection.ImageUrl = request.ImageUrl?.Trim() ?? string.Empty;
            collection.IsActive = request.IsActive;
            collection.SortOrder = request.SortOrder;
            collection.UpdatedAt = DateTime.UtcNow;

            SyncProducts(collection, request.ProductIds);
            await _context.SaveChangesAsync();

            return Ok(new { collection.Id, collection.Name, collection.Slug });
        }

        [HttpDelete("{id:int}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> DeleteCollection(int id)
        {
            var collection = await _context.Collections.FirstOrDefaultAsync(item => item.Id == id);
            if (collection == null)
                return NotFound(new { message = "Không tìm thấy bộ sưu tập." });

            collection.IsDeleted = true;
            collection.DeletedAt = DateTime.UtcNow;
            collection.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return NoContent();
        }

        private IQueryable<Collection> CollectionDetailsQuery()
        {
            return _context.Collections
                .AsNoTracking()
                .Include(collection => collection.ProductCollections)
                    .ThenInclude(item => item.Product)
                        .ThenInclude(product => product!.Brand)
                .Include(collection => collection.ProductCollections)
                    .ThenInclude(item => item.Product)
                        .ThenInclude(product => product!.Category)
                .Include(collection => collection.ProductCollections)
                    .ThenInclude(item => item.Product)
                        .ThenInclude(product => product!.Images)
                .Include(collection => collection.ProductCollections)
                    .ThenInclude(item => item.Product)
                        .ThenInclude(product => product!.ProductVariants)
                            .ThenInclude(variant => variant.Color)
                .Include(collection => collection.ProductCollections)
                    .ThenInclude(item => item.Product)
                        .ThenInclude(product => product!.ProductVariants)
                            .ThenInclude(variant => variant.Size)
                .Include(collection => collection.ProductCollections)
                    .ThenInclude(item => item.Product)
                        .ThenInclude(product => product!.ProductVariants)
                            .ThenInclude(variant => variant.Images)
                .AsSplitQuery();
        }

        private async Task<string?> ValidateRequestAsync(CollectionRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
                return "Tên bộ sưu tập là bắt buộc.";
            if (request.Name.Trim().Length > 160)
                return "Tên bộ sưu tập không được vượt quá 160 ký tự.";
            if ((request.Subtitle?.Trim().Length ?? 0) > 200)
                return "Tiêu đề phụ không được vượt quá 200 ký tự.";
            if ((request.Description?.Trim().Length ?? 0) > 1200)
                return "Mô tả không được vượt quá 1.200 ký tự.";
            if ((request.ImageUrl?.Trim().Length ?? 0) > 2000)
                return "Đường dẫn ảnh bìa quá dài. Vui lòng dùng URL ảnh ngắn hơn 2.000 ký tự.";
            if (!string.IsNullOrWhiteSpace(request.ImageUrl)
                && (!Uri.TryCreate(request.ImageUrl.Trim(), UriKind.Absolute, out var imageUri)
                    || (imageUri.Scheme != Uri.UriSchemeHttp && imageUri.Scheme != Uri.UriSchemeHttps)))
                return "Đường dẫn ảnh bìa phải là URL http hoặc https hợp lệ.";

            var productIds = NormalizeProductIds(request.ProductIds);
            if (productIds.Count == 0) return null;

            var existingCount = await _context.Products.CountAsync(product => productIds.Contains(product.Id));
            return existingCount == productIds.Count ? null : "Một hoặc nhiều sản phẩm đã chọn không tồn tại.";
        }

        private async Task<string> CreateUniqueSlugAsync(string name, int? excludedId = null)
        {
            var baseSlug = SlugHelper.GenerateSlug(name);
            var slug = baseSlug;
            var suffix = 2;

            while (await _context.Collections.IgnoreQueryFilters()
                .AnyAsync(collection => (!excludedId.HasValue || collection.Id != excludedId.Value) && collection.Slug == slug))
            {
                slug = $"{baseSlug}-{suffix++}";
            }

            return slug;
        }

        private static List<int> NormalizeProductIds(IEnumerable<int>? productIds)
        {
            return (productIds ?? Array.Empty<int>())
                .Where(id => id > 0)
                .Distinct()
                .ToList();
        }

        private static void SetProducts(Collection collection, IEnumerable<int>? productIds)
        {
            collection.ProductCollections = NormalizeProductIds(productIds)
                .Select((productId, index) => new ProductCollection
                {
                    Collection = collection,
                    ProductId = productId,
                    SortOrder = index
                })
                .ToList();
        }

        private void SyncProducts(Collection collection, IEnumerable<int>? productIds)
        {
            var desiredIds = NormalizeProductIds(productIds);
            var desiredSet = desiredIds.ToHashSet();
            var removedItems = collection.ProductCollections
                .Where(item => !desiredSet.Contains(item.ProductId))
                .ToList();

            _context.ProductCollections.RemoveRange(removedItems);

            desiredIds.ForEach((productId) =>
            {
                var sortOrder = desiredIds.IndexOf(productId);
                var existing = collection.ProductCollections.FirstOrDefault(item => item.ProductId == productId);
                if (existing != null)
                {
                    existing.SortOrder = sortOrder;
                    return;
                }

                collection.ProductCollections.Add(new ProductCollection
                {
                    CollectionId = collection.Id,
                    ProductId = productId,
                    SortOrder = sortOrder
                });
            });
        }

        private static object ToProductDto(Product product)
        {
            var variants = product.ProductVariants
                .Where(variant => !variant.IsDeleted)
                .ToList();
            var mainImageUrl = string.IsNullOrWhiteSpace(product.MainImageUrl)
                ? product.Images.OrderBy(image => image.SortOrder).Select(image => image.Url).FirstOrDefault()
                    ?? variants.SelectMany(variant => variant.Images).OrderBy(image => image.SortOrder).Select(image => image.Url).FirstOrDefault()
                    ?? string.Empty
                : product.MainImageUrl;
            var minPrice = variants.Count == 0 ? 0 : variants.Min(variant => variant.Price);

            return new
            {
                product.Id,
                product.Name,
                slug = string.IsNullOrWhiteSpace(product.Slug) ? SlugHelper.GenerateSlug(product.Name) : product.Slug,
                product.Description,
                mainImageUrl,
                price = minPrice,
                minPrice,
                maxPrice = variants.Count == 0 ? 0 : variants.Max(variant => variant.Price),
                totalStock = variants.Where(variant => variant.IsAvailable).Sum(variant => variant.Stock),
                stock = variants.Where(variant => variant.IsAvailable).Sum(variant => variant.Stock),
                product.Rating,
                product.ReviewCount,
                product.IsFeatured,
                product.IsAvailable,
                product.CategoryId,
                categoryName = product.Category?.Name ?? string.Empty,
                brandName = product.Brand?.Name ?? string.Empty,
                variants = variants.Select(variant => new
                {
                    variant.Id,
                    variant.SizeId,
                    size = variant.Size?.Name ?? string.Empty,
                    variant.ColorId,
                    color = variant.Color?.Name ?? string.Empty,
                    hexCode = variant.Color?.HexCode ?? string.Empty,
                    variant.Price,
                    variant.Sku,
                    variant.Stock,
                    variant.IsAvailable
                }),
                productVariants = variants.Select(variant => new
                {
                    variant.Id,
                    variant.SizeId,
                    Size = variant.Size?.Name ?? string.Empty,
                    variant.ColorId,
                    Color = variant.Color?.Name ?? string.Empty,
                    HexCode = variant.Color?.HexCode ?? string.Empty,
                    variant.Price,
                    variant.Sku,
                    variant.Stock,
                    variant.IsAvailable
                })
            };
        }
    }

}
