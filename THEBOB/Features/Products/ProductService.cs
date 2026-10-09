using Microsoft.EntityFrameworkCore;
using THEBOB.Controllers;
using THEBOB.Data;
using THEBOB.Helpers;
using THEBOB.Models;

namespace THEBOB.Services
{
    public class ProductService : IProductService
    {
        private readonly ThebobDbContext _context;

        public ProductService(ThebobDbContext context)
        {
            _context = context;
        }

        private const int SearchTake = 48;

        public async Task<List<object>> GetProductsAsync()
        {
            return await ProjectListAsync(ListQuery());
        }

        public async Task<(bool Success, string Message, int StatusCode, object? Data)> GetProductAsync(string identifier)
        {
            if (string.IsNullOrWhiteSpace(identifier))
                return (false, "Product identifier is required", 400, null);

            Product? product = null;

            if (int.TryParse(identifier, out var id) && id > 0)
            {
                product = await ProductQuery().FirstOrDefaultAsync(p => p.Id == id);
            }

            if (product == null)
            {
                var cleanSlug = identifier.Trim().ToLower();
                product = await ProductQuery().FirstOrDefaultAsync(p => p.Slug == cleanSlug || p.Slug == identifier);
            }

            if (product == null)
                return (false, $"Product with identifier ''{identifier}'' not found", 404, null);

            return (true, string.Empty, 200, ToProductDto(product));
        }

        public async Task<List<Category>> GetCategoriesAsync()
        {
            return await _context.Categories.OrderBy(c => c.Name).ToListAsync();
        }

        public async Task<List<Brand>> GetBrandsAsync()
        {
            return await _context.Brands.OrderBy(b => b.Name).ToListAsync();
        }

        public async Task<List<Size>> GetSizesAsync()
        {
            return await _context.Sizes.OrderBy(s => s.Name).ToListAsync();
        }

        public async Task<List<Color>> GetColorsAsync()
        {
            return await _context.Colors.OrderBy(c => c.Name).ToListAsync();
        }

        public async Task<(bool Success, string Message, int StatusCode, Color? Data)> CreateColorAsync(Color color)
        {
            if (color == null || string.IsNullOrWhiteSpace(color.Name))
                return (false, "Tên màu là bắt buộc", 400, null);

            if (string.IsNullOrWhiteSpace(color.HexCode))
            {
                color.HexCode = "#000000";
            }
            else
            {
                color.HexCode = color.HexCode.Trim();
                var hexRegex = new System.Text.RegularExpressions.Regex(@"^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$");
                if (!hexRegex.IsMatch(color.HexCode))
                {
                    return (false, "Mã màu HEX không hợp lệ (VD: #000000 hoặc #FFF)", 400, null);
                }
            }

            var exists = await _context.Colors.AnyAsync(c => c.Name.ToLower() == color.Name.ToLower());
            if (exists) return (false, "Màu này đã tồn tại", 400, null);

            _context.Colors.Add(color);
            await _context.SaveChangesAsync();
            return (true, string.Empty, 200, color);
        }

        public async Task<(bool Success, string Message, int StatusCode, Color? Data)> UpdateColorAsync(int id, Color color)
        {
            if (color == null || string.IsNullOrWhiteSpace(color.Name))
                return (false, "Tên màu là bắt buộc", 400, null);

            var existing = await _context.Colors.FindAsync(id);
            if (existing == null) return (false, "Không tìm thấy màu", 404, null);

            var duplicate = await _context.Colors.AnyAsync(c => c.Id != id && c.Name.ToLower() == color.Name.ToLower());
            if (duplicate) return (false, "Màu này đã tồn tại", 400, null);

            existing.Name = color.Name.Trim();
            existing.HexCode = string.IsNullOrWhiteSpace(color.HexCode) ? "#000000" : color.HexCode.Trim();
            await _context.SaveChangesAsync();
            return (true, string.Empty, 200, existing);
        }

        public async Task<(bool Success, string Message, int StatusCode)> DeleteColorAsync(int id)
        {
            var existing = await _context.Colors.FindAsync(id);
            if (existing == null) return (false, "Không tìm thấy màu", 404);

            var inUse = await _context.ProductVariants.AnyAsync(v => v.ColorId == id);
            if (inUse)
                return (false, "Màu này đang được sử dụng bởi biến thể sản phẩm, không thể xóa", 400);

            _context.Colors.Remove(existing);
            await _context.SaveChangesAsync();
            return (true, "Đã xóa màu", 200);
        }

        public async Task<(bool Success, string Message, int StatusCode, Size? Data)> CreateSizeAsync(Size size)
        {
            if (size == null || string.IsNullOrWhiteSpace(size.Name))
                return (false, "Tên kích thước là bắt buộc", 400, null);

            var exists = await _context.Sizes.AnyAsync(s => s.Name.ToLower() == size.Name.ToLower());
            if (exists) return (false, "Kích thước này đã tồn tại", 400, null);

            _context.Sizes.Add(size);
            await _context.SaveChangesAsync();
            return (true, string.Empty, 200, size);
        }

        public async Task<(bool Success, string Message, int StatusCode, Size? Data)> UpdateSizeAsync(int id, Size size)
        {
            if (size == null || string.IsNullOrWhiteSpace(size.Name))
                return (false, "Tên kích thước là bắt buộc", 400, null);

            var existing = await _context.Sizes.FindAsync(id);
            if (existing == null) return (false, "Không tìm thấy size", 404, null);

            var duplicate = await _context.Sizes.AnyAsync(s => s.Id != id && s.Name.ToLower() == size.Name.ToLower());
            if (duplicate) return (false, "Kích thước này đã tồn tại", 400, null);

            existing.Name = size.Name.Trim();
            await _context.SaveChangesAsync();
            return (true, string.Empty, 200, existing);
        }

        public async Task<(bool Success, string Message, int StatusCode)> DeleteSizeAsync(int id)
        {
            var existing = await _context.Sizes.FindAsync(id);
            if (existing == null) return (false, "Không tìm thấy size", 404);

            var inUse = await _context.ProductVariants.AnyAsync(v => v.SizeId == id);
            if (inUse)
                return (false, "Size này đang được sử dụng bởi biến thể sản phẩm, không thể xóa", 400);

            _context.Sizes.Remove(existing);
            await _context.SaveChangesAsync();
            return (true, "Đã xóa size", 200);
        }
        public async Task<(bool Success, string Message, int StatusCode, object? Data)> CreateProductAsync(ProductCreateRequest request)
        {
            if (request.Variants == null || !request.Variants.Any())
                return (false, "Product must have at least one variant.", 400, null);

            var validationError = ValidateProductRequest(request);
            if (validationError != null)
                return (false, validationError, 400, null);

            var requestSkus = request.Variants.Select(v => v.Sku!.Trim()).ToList();
            if (requestSkus.Count != requestSkus.Distinct(StringComparer.OrdinalIgnoreCase).Count())
            {
                return (false, "Các mã SKU của các biến thể không được trùng nhau.", 400, null);
            }

            var skus = request.Variants.Select(v => v.Sku!.Trim().ToLower()).ToList();
            var existingVariant = await _context.ProductVariants
                .FirstOrDefaultAsync(v => skus.Contains(v.Sku.ToLower()));
            if (existingVariant != null)
            {
                return (false, $"Mã SKU ''{existingVariant.Sku}'' đã tồn tại ở một sản phẩm khác.", 400, null);
            }

            var product = new Product
            {
                Name = request.Name.Trim(),
                Description = request.Description?.Trim() ?? string.Empty,
                BrandId = request.BrandId,
                Material = request.Material?.Trim() ?? string.Empty,
                CareInstructions = request.CareInstructions?.Trim() ?? string.Empty,
                MainImageUrl = request.MainImageUrl?.Trim() ?? string.Empty,
                IsFeatured = request.IsFeatured,
                IsAvailable = request.IsAvailable,
                CategoryId = request.CategoryId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            if (request.ImageUrls != null)
            {
                product.Images = request.ImageUrls
                    .Where(url => !string.IsNullOrWhiteSpace(url))
                    .Select((url, index) => new ProductImage { Url = url.Trim(), SortOrder = index })
                    .ToList();
            }

            var colorImageUrls = BuildColorImageUrlMap(request);
            foreach (var variantRequest in request.Variants)
            {
                product.ProductVariants.Add(CreateVariant(product, variantRequest, colorImageUrls));
            }

            _context.Products.Add(product);
            await _context.SaveChangesAsync();

            var createdProduct = await ProductQuery().FirstAsync(p => p.Id == product.Id);
            return (true, string.Empty, 201, ToProductDto(createdProduct));
        }

        public async Task<(bool Success, string Message, int StatusCode)> UpdateProductAsync(int id, ProductUpdateRequest request)
        {
            var validationError = ValidateProductRequest(request);
            if (validationError != null)
                return (false, validationError, 400);

            if (request.Variants != null)
            {
                var requestSkus = request.Variants.Select(v => v.Sku!.Trim()).ToList();
                if (requestSkus.Count != requestSkus.Distinct(StringComparer.OrdinalIgnoreCase).Count())
                {
                    return (false, "Các mã SKU của các biến thể không được trùng nhau.", 400);
                }

                var skus = request.Variants.Select(v => v.Sku!.Trim().ToLower()).ToList();
                var existingVariant = await _context.ProductVariants
                    .FirstOrDefaultAsync(v => skus.Contains(v.Sku.ToLower()) && v.ProductId != id);
                if (existingVariant != null)
                {
                    return (false, $"Mã SKU ''{existingVariant.Sku}'' đã tồn tại ở một sản phẩm khác.", 400);
                }
            }

            var product = await _context.Products
                .Include(p => p.Images)
                .Include(p => p.ProductVariants)
                    .ThenInclude(v => v.Images)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (product == null)
                return (false, "Not found", 404);

            product.Name = request.Name.Trim();
            product.Description = request.Description?.Trim() ?? string.Empty;
            product.BrandId = request.BrandId;
            product.Material = request.Material?.Trim() ?? string.Empty;
            product.CareInstructions = request.CareInstructions?.Trim() ?? string.Empty;
            product.MainImageUrl = request.MainImageUrl?.Trim() ?? string.Empty;
            product.IsFeatured = request.IsFeatured;
            product.IsAvailable = request.IsAvailable;
            product.CategoryId = request.CategoryId;
            product.UpdatedAt = DateTime.UtcNow;

            if (request.ImageUrls != null)
            {
                _context.ProductImages.RemoveRange(product.Images);
                product.Images.Clear();
                foreach (var item in request.ImageUrls.Where(url => !string.IsNullOrWhiteSpace(url)).Select((url, index) => new { url, index }))
                {
                    product.Images.Add(new ProductImage { Url = item.url.Trim(), SortOrder = item.index });
                }
            }

            if (request.Variants != null)
            {
                var colorImageUrls = BuildColorImageUrlMap(request);
                var requestIds = request.Variants.Where(v => v.Id.HasValue).Select(v => v.Id!.Value).ToHashSet();

                foreach (var existing in product.ProductVariants.Where(v => !requestIds.Contains(v.Id)))
                {
                    existing.IsDeleted = true;
                    existing.IsAvailable = false;
                    existing.DeletedAt = DateTime.UtcNow;
                    existing.UpdatedAt = DateTime.UtcNow;
                }

                foreach (var variantRequest in request.Variants)
                {
                    var existing = variantRequest.Id.HasValue
                        ? product.ProductVariants.FirstOrDefault(v => v.Id == variantRequest.Id.Value)
                        : product.ProductVariants.FirstOrDefault(v =>
                            v.IsDeleted
                            && v.ColorId == variantRequest.ColorId!.Value
                            && v.SizeId == variantRequest.SizeId!.Value);

                    if (existing == null)
                    {
                        product.ProductVariants.Add(CreateVariant(product, variantRequest, colorImageUrls));
                        continue;
                    }

                    existing.SizeId = variantRequest.SizeId!.Value;
                    existing.ColorId = variantRequest.ColorId!.Value;
                    existing.Price = variantRequest.Price;
                    existing.Stock = variantRequest.Stock;
                    existing.Sku = variantRequest.Sku!.Trim();
                    existing.IsAvailable = variantRequest.IsAvailable ?? variantRequest.Stock > 0;
                    existing.IsDeleted = false;
                    existing.DeletedAt = null;
                    existing.UpdatedAt = DateTime.UtcNow;
                    ReplaceVariantImages(existing, ResolveVariantImageUrls(variantRequest, colorImageUrls));
                }
            }

            await _context.SaveChangesAsync();
            return (true, string.Empty, 204);
        }

        public async Task<(bool Success, string Message, int StatusCode)> DeleteProductAsync(int id)
        {
            var product = await _context.Products
                .Include(p => p.ProductVariants)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (product == null)
                return (false, "Not found", 404);

            product.IsDeleted = true;
            product.DeletedAt = DateTime.UtcNow;
            product.UpdatedAt = DateTime.UtcNow;

            foreach (var variant in product.ProductVariants)
            {
                variant.IsDeleted = true;
                variant.IsAvailable = false;
                variant.DeletedAt = DateTime.UtcNow;
                variant.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
            return (true, string.Empty, 204);
        }

        public async Task<List<object>> SearchAsync(
            string? query,
            int? categoryId,
            string? color,
            decimal? minPrice,
            decimal? maxPrice)
        {
            var q = ListQuery();

            if (!string.IsNullOrWhiteSpace(query))
            {
                q = q.Where(p =>
                    p.Name.Contains(query) ||
                    (p.Description != null && p.Description.Contains(query)) ||
                    p.ProductVariants.Any(v => v.Sku.Contains(query)));
            }

            if (categoryId.HasValue)
                q = q.Where(p => p.CategoryId == categoryId.Value);

            if (!string.IsNullOrWhiteSpace(color))
                q = q.Where(p => p.ProductVariants.Any(v => v.Color != null && v.Color.Name == color));

            if (minPrice.HasValue || maxPrice.HasValue)
            {
                q = q.Where(p => p.ProductVariants.Any(v =>
                    (!minPrice.HasValue || v.Price >= minPrice.Value) &&
                    (!maxPrice.HasValue || v.Price <= maxPrice.Value)));
            }

            if (!string.IsNullOrWhiteSpace(query))
                q = q.OrderByDescending(p => p.Name.StartsWith(query)).ThenBy(p => p.Name);
            else
                q = q.OrderBy(p => p.Name);

            return await ProjectListAsync(q.Take(SearchTake));
        }

        private IQueryable<Product> ListQuery()
        {
            return _context.Products.AsNoTracking();
        }

        private async Task<List<object>> ProjectListAsync(IQueryable<Product> query)
        {
            var rows = await query
                .Select(p => new
                {
                    p.Id,
                    p.Name,
                    p.Slug,
                    p.Description,
                    p.BrandId,
                    BrandName = p.Brand != null ? p.Brand.Name : string.Empty,
                    MainImageUrl = p.MainImageUrl != null && p.MainImageUrl != string.Empty
                        ? p.MainImageUrl
                        : p.Images.OrderBy(i => i.SortOrder).Select(i => i.Url).FirstOrDefault()
                            ?? p.ProductVariants
                                .Where(v => !v.IsDeleted)
                                .SelectMany(v => v.Images)
                                .OrderBy(i => i.SortOrder)
                                .Select(i => i.Url)
                                .FirstOrDefault()
                            ?? string.Empty,
                    p.Rating,
                    p.ReviewCount,
                    p.IsFeatured,
                    p.IsAvailable,
                    p.CategoryId,
                    CategoryName = p.Category != null ? p.Category.Name : string.Empty,
                    MinPrice = p.ProductVariants.Where(v => !v.IsDeleted).Select(v => (decimal?)v.Price).Min() ?? 0,
                    MaxPrice = p.ProductVariants.Where(v => !v.IsDeleted).Select(v => (decimal?)v.Price).Max() ?? 0,
                    TotalStock = p.ProductVariants.Where(v => !v.IsDeleted).Sum(v => (int?)v.Stock) ?? 0,
                    VariantCount = p.ProductVariants.Count(v => !v.IsDeleted),
                    Sku = p.ProductVariants.Where(v => !v.IsDeleted).OrderBy(v => v.Id).Select(v => v.Sku).FirstOrDefault() ?? string.Empty,
                    Variants = p.ProductVariants
                        .Where(v => !v.IsDeleted)
                        .Select(v => new
                        {
                            v.Id,
                            v.SizeId,
                            v.ColorId,
                            v.Price,
                            v.Sku,
                            v.Stock,
                            v.IsAvailable
                        })
                })
                .ToListAsync();

            return rows.Select(p => (object)new
            {
                id = p.Id,
                name = p.Name,
                slug = string.IsNullOrWhiteSpace(p.Slug) ? SlugHelper.GenerateSlug(p.Name) : p.Slug,
                sku = p.Sku,
                description = p.Description,
                brandId = p.BrandId,
                brand = p.BrandName,
                mainImageUrl = p.MainImageUrl,
                minPrice = p.MinPrice,
                maxPrice = p.MaxPrice,
                price = p.MinPrice,
                totalStock = p.TotalStock,
                stock = p.TotalStock,
                rating = p.Rating,
                reviewCount = p.ReviewCount,
                variants = p.Variants,
                productVariants = p.Variants,
                isFeatured = p.IsFeatured,
                isAvailable = p.IsAvailable,
                categoryId = p.CategoryId,
                category = p.CategoryName,
                categoryName = p.CategoryName,
                brandName = p.BrandName,
                variantCount = p.VariantCount
            }).ToList();
        }

        private IQueryable<Product> ProductQuery()
        {
            return _context.Products
                .AsNoTracking()
                .Include(p => p.Brand)
                .Include(p => p.Category)
                .Include(p => p.Images)
                .Include(p => p.ProductVariants)
                    .ThenInclude(v => v.Size)
                .Include(p => p.ProductVariants)
                    .ThenInclude(v => v.Color)
                .Include(p => p.ProductVariants)
                    .ThenInclude(v => v.Images)
                .AsSplitQuery();
        }

        private static ProductVariant CreateVariant(
            Product product,
            VariantItemDto variantRequest,
            IReadOnlyDictionary<int, List<string>> colorImageUrls)
        {
            var variant = new ProductVariant
            {
                Product = product,
                SizeId = variantRequest.SizeId!.Value,
                ColorId = variantRequest.ColorId!.Value,
                Price = variantRequest.Price,
                Stock = variantRequest.Stock,
                Sku = variantRequest.Sku!.Trim(),
                IsAvailable = variantRequest.IsAvailable ?? variantRequest.Stock > 0,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            ReplaceVariantImages(variant, ResolveVariantImageUrls(variantRequest, colorImageUrls));
            return variant;
        }

        private static Dictionary<int, List<string>> BuildColorImageUrlMap(ProductCreateRequest request)
        {
            if (request.ColorImages == null)
                return new Dictionary<int, List<string>>();

            return request.ColorImages
                .Where(group => group.ColorId.HasValue)
                .GroupBy(group => group.ColorId!.Value)
                .ToDictionary(
                    group => group.Key,
                    group => group
                        .SelectMany(item => item.ImageUrls ?? new List<string>())
                        .Where(url => !string.IsNullOrWhiteSpace(url))
                        .Select(url => url.Trim())
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .ToList());
        }

        private static List<string>? ResolveVariantImageUrls(
            VariantItemDto variantRequest,
            IReadOnlyDictionary<int, List<string>> colorImageUrls)
        {
            if (variantRequest.ColorId.HasValue
                && colorImageUrls.TryGetValue(variantRequest.ColorId.Value, out var images))
            {
                return images;
            }

            return variantRequest.ImageUrls;
        }

        private static void ReplaceVariantImages(ProductVariant variant, List<string>? imageUrls)
        {
            variant.Images.Clear();
            if (imageUrls == null) return;

            foreach (var image in imageUrls.Where(url => !string.IsNullOrWhiteSpace(url)).Select((url, index) => new { url, index }))
            {
                variant.Images.Add(new ProductVariantImage
                {
                    Url = image.url.Trim(),
                    SortOrder = image.index,
                    CreatedAt = DateTime.UtcNow
                });
            }
        }

        private static string? ValidateProductRequest(ProductCreateRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
                return "Product name is required.";

            if (!request.BrandId.HasValue)
                return "BrandId is required.";

            if (!request.CategoryId.HasValue)
                return "CategoryId is required.";

            if (request.Variants == null || request.Variants.Count == 0)
                return "Product must have at least one variant.";

            if (request.ColorImages != null)
            {
                if (request.ColorImages.Any(group => !group.ColorId.HasValue))
                    return "ColorImages ColorId is required.";

                var duplicateColorGroup = request.ColorImages
                    .GroupBy(group => group.ColorId!.Value)
                    .Any(group => group.Count() > 1);
                if (duplicateColorGroup)
                    return "Each color can have only one image group.";

                var variantColorIds = request.Variants
                    .Where(variant => variant.ColorId.HasValue)
                    .Select(variant => variant.ColorId!.Value)
                    .Distinct()
                    .ToHashSet();
                var imageColorIds = request.ColorImages
                    .Select(group => group.ColorId!.Value)
                    .ToHashSet();

                if (!imageColorIds.SetEquals(variantColorIds))
                    return "Color image groups must match the product variant colors.";

                if (request.ColorImages.Any(group => group.ImageUrls == null
                    || !group.ImageUrls.Any(url => !string.IsNullOrWhiteSpace(url))))
                {
                    return "Each product color must have at least one image.";
                }
            }

            foreach (var variant in request.Variants)
            {
                if (!variant.ColorId.HasValue)
                    return "Variant ColorId is required.";

                if (!variant.SizeId.HasValue)
                    return "Variant SizeId is required.";

                if (string.IsNullOrWhiteSpace(variant.Sku))
                    return "Variant SKU is required.";

                if (variant.Price <= 0)
                    return "Variant price must be greater than 0.";

                if (variant.Stock < 0)
                    return "Variant stock cannot be negative.";
            }

            return null;
        }

        private static object ToProductDto(Product p)
        {
            var activeVariants = p.ProductVariants.Where(v => !v.IsDeleted).ToList();
            var minPrice = activeVariants.Count == 0 ? 0 : activeVariants.Min(v => v.Price);
            var colorImages = activeVariants
                .GroupBy(v => v.ColorId)
                .Select(group => new
                {
                    colorId = group.Key,
                    color = group.First().Color?.Name ?? string.Empty,
                    hexCode = group.First().Color?.HexCode ?? string.Empty,
                    images = group
                        .SelectMany(variant => variant.Images)
                        .OrderBy(image => image.SortOrder)
                        .GroupBy(image => image.Url, StringComparer.OrdinalIgnoreCase)
                        .Select((images, index) => new
                        {
                            id = images.First().Id,
                            url = images.Key,
                            sortOrder = index
                        })
                        .ToList()
                })
                .ToList();
            var effectiveMainImage = string.IsNullOrWhiteSpace(p.MainImageUrl)
                ? p.Images.OrderBy(image => image.SortOrder).Select(image => image.Url).FirstOrDefault()
                    ?? colorImages.SelectMany(group => group.images).Select(image => image.url).FirstOrDefault()
                    ?? string.Empty
                : p.MainImageUrl;

            return new
            {
                id = p.Id,
                name = p.Name,
                slug = string.IsNullOrWhiteSpace(p.Slug) ? SlugHelper.GenerateSlug(p.Name) : p.Slug,
                sku = activeVariants.FirstOrDefault()?.Sku ?? string.Empty,
                description = p.Description,
                brandId = p.BrandId,
                brand = p.Brand?.Name ?? string.Empty,
                material = p.Material,
                careInstructions = p.CareInstructions,
                mainImageUrl = effectiveMainImage,
                minPrice,
                maxPrice = activeVariants.Count == 0 ? 0 : activeVariants.Max(v => v.Price),
                price = minPrice,
                totalStock = activeVariants.Sum(v => v.Stock),
                stock = activeVariants.Sum(v => v.Stock),
                rating = p.Rating,
                reviewCount = p.ReviewCount,
                images = p.Images.OrderBy(i => i.SortOrder).Select(i => new { i.Id, url = i.Url, i.SortOrder }),
                colorImages,
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
                }),
                productVariants = activeVariants.Select(v => new
                {
                    v.Id,
                    v.SizeId,
                    v.ColorId,
                    Size = v.Size?.Name ?? string.Empty,
                    Color = v.Color?.Name ?? string.Empty,
                    HexCode = v.Color?.HexCode ?? string.Empty,
                    v.Price,
                    v.Sku,
                    v.Stock,
                    v.IsAvailable,
                    images = v.Images.OrderBy(i => i.SortOrder).Select(i => new { i.Id, url = i.Url, i.SortOrder })
                }),
                sizes = activeVariants
                    .Where(v => v.Size != null)
                    .Select(v => new { id = v.SizeId, sizeValue = v.Size!.Name })
                    .Distinct(),
                isFeatured = p.IsFeatured,
                isAvailable = p.IsAvailable,
                categoryId = p.CategoryId,
                category = p.Category?.Name ?? string.Empty,
                categoryName = p.Category?.Name ?? string.Empty,
                brandName = p.Brand?.Name ?? string.Empty,
                variantCount = activeVariants.Count
            };
        }
    }
}
