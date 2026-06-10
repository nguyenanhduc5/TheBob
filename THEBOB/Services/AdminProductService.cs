using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using THEBOB.DTOs.AdminProducts;
using THEBOB.Models;
using THEBOB.Repositories;

namespace THEBOB.Services
{
    public class AdminProductService : IAdminProductService
    {
        private readonly IAdminProductRepository _repository;

        public AdminProductService(IAdminProductRepository repository)
        {
            _repository = repository;
        }

        public async Task<ServiceResult<IReadOnlyList<AdminProductListItemDto>>> GetProductsAsync(CancellationToken cancellationToken)
        {
            var products = await _repository.QueryProductsForAdmin()
                .OrderByDescending(p => p.CreatedAt)
                .ToListAsync(cancellationToken);

            return ServiceResult<IReadOnlyList<AdminProductListItemDto>>.Success(products.Select(ToListDto).ToList());
        }

        public async Task<ServiceResult<AdminProductDetailDto>> GetProductAsync(int id, CancellationToken cancellationToken)
        {
            var product = await _repository.GetProductForAdminAsync(id, cancellationToken);
            if (product == null)
                return ServiceResult<AdminProductDetailDto>.Failure("Product not found.", StatusCodes.Status404NotFound);

            return ServiceResult<AdminProductDetailDto>.Success(ToDetailDto(product));
        }

        public async Task<ServiceResult<AdminProductDetailDto>> CreateProductAsync(AdminProductCreateRequest request, int? userId, CancellationToken cancellationToken)
        {
            var validation = ValidateProductCreate(request);
            if (validation != null)
                return ServiceResult<AdminProductDetailDto>.Failure(validation, StatusCodes.Status400BadRequest);

            await using var tx = await _repository.BeginTransactionAsync(cancellationToken);

            var product = new Product
            {
                Name = request.Name.Trim(),
                Description = request.Description.Trim(),
                BrandId = await ResolveBrandIdAsync(request.BrandId, request.BrandName, cancellationToken),
                CategoryId = request.CategoryId,
                Material = request.Material.Trim(),
                CareInstructions = request.CareInstructions.Trim(),
                IsFeatured = request.IsFeatured,
                IsAvailable = true,
                MainImageUrl = request.ImageUrls.FirstOrDefault()?.Trim() ?? string.Empty,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            product.Images = BuildProductImages(request.ImageUrls);

            foreach (var variantRequest in request.Variants)
            {
                var variant = await BuildNewVariantAsync(product, variantRequest, cancellationToken);
                product.ProductVariants.Add(variant);
            }

            _repository.AddProduct(product);
            await _repository.SaveChangesAsync(cancellationToken);

            foreach (var variant in product.ProductVariants)
            {
                if (variant.Stock > 0)
                {
                    _repository.AddInventoryLog(new InventoryLog
                    {
                        VariantId = variant.Id,
                        ChangeType = InventoryChangeType.InitialStock,
                        QuantityChanged = variant.Stock,
                        Reason = "Initial stock",
                        UserId = userId,
                        CreatedAt = DateTime.UtcNow
                    });
                }
            }

            AddAudit(userId, "Create", "Products", null, ProductAuditSnapshot(product));
            foreach (var variant in product.ProductVariants)
                AddAudit(userId, "Create", "ProductVariants", null, VariantAuditSnapshot(variant));

            await _repository.SaveChangesAsync(cancellationToken);
            await tx.CommitAsync(cancellationToken);

            var created = await _repository.GetProductForAdminAsync(product.Id, cancellationToken);
            return ServiceResult<AdminProductDetailDto>.Success(ToDetailDto(created!), StatusCodes.Status201Created);
        }

        public async Task<ServiceResult<AdminProductDetailDto>> UpdateProductAsync(int id, AdminProductUpdateRequest request, int? userId, CancellationToken cancellationToken)
        {
            var validation = ValidateProductUpdate(request);
            if (validation != null)
                return ServiceResult<AdminProductDetailDto>.Failure(validation, StatusCodes.Status400BadRequest);

            var product = await _repository.GetProductForAdminAsync(id, cancellationToken);
            if (product == null)
                return ServiceResult<AdminProductDetailDto>.Failure("Product not found.", StatusCodes.Status404NotFound);

            await using var tx = await _repository.BeginTransactionAsync(cancellationToken);

            var oldProduct = ProductAuditSnapshot(product);
            product.Name = request.Name.Trim();
            product.Description = request.Description.Trim();
            product.BrandId = await ResolveBrandIdAsync(request.BrandId, request.BrandName, cancellationToken);
            product.CategoryId = request.CategoryId;
            product.Material = request.Material.Trim();
            product.CareInstructions = request.CareInstructions.Trim();
            product.IsFeatured = request.IsFeatured;
            product.IsAvailable = request.IsAvailable;
            product.UpdatedAt = DateTime.UtcNow;

            if (request.ImageUrls != null)
            {
                _repository.RemoveProductImages(product.Images);
                product.Images = BuildProductImages(request.ImageUrls);
                product.MainImageUrl = request.ImageUrls.FirstOrDefault()?.Trim() ?? string.Empty;
            }

            var activePairs = product.ProductVariants
                .Where(v => !v.IsDeleted)
                .Select(v => (v.ColorId, v.SizeId, VariantId: v.Id))
                .ToList();

            foreach (var variantRequest in request.Variants)
            {
                var colorId = await ResolveColorIdAsync(variantRequest.ColorId, variantRequest.ColorName, variantRequest.HexCode, cancellationToken);
                var sizeId = await ResolveSizeIdAsync(variantRequest.SizeId, variantRequest.SizeName, cancellationToken);

                var duplicate = activePairs.Any(p => p.ColorId == colorId && p.SizeId == sizeId && p.VariantId != variantRequest.Id);
                if (duplicate)
                    return ServiceResult<AdminProductDetailDto>.Failure("Duplicate Color + Size variant is not allowed.", StatusCodes.Status400BadRequest);

                if (variantRequest.Id.HasValue)
                {
                    var variant = product.ProductVariants.FirstOrDefault(v => v.Id == variantRequest.Id.Value);
                    if (variant == null)
                        return ServiceResult<AdminProductDetailDto>.Failure($"Variant {variantRequest.Id.Value} not found in product.", StatusCodes.Status404NotFound);

                    var oldVariant = VariantAuditSnapshot(variant);
                    var oldStock = variant.Stock;

                    variant.ColorId = colorId;
                    variant.SizeId = sizeId;
                    variant.Price = variantRequest.Price;
                    variant.Stock = variantRequest.Stock;
                    variant.IsAvailable = variantRequest.IsAvailable;
                    variant.IsDeleted = false;
                    variant.DeletedAt = null;
                    variant.UpdatedAt = DateTime.UtcNow;

                    if (variant.Images.Any())
                        _repository.RemoveVariantImages(variant.Images);

                    variant.Images = BuildVariantImages(variantRequest.ImageUrls);

                    if (variant.Stock != oldStock)
                    {
                        _repository.AddInventoryLog(new InventoryLog
                        {
                            VariantId = variant.Id,
                            ChangeType = InventoryChangeType.Adjusted,
                            QuantityChanged = variant.Stock - oldStock,
                            Reason = "Admin product update",
                            UserId = userId,
                            CreatedAt = DateTime.UtcNow
                        });
                    }

                    AddAudit(userId, "Update", "ProductVariants", oldVariant, VariantAuditSnapshot(variant));
                }
                else
                {
                    var newVariant = await BuildNewVariantAsync(product, variantRequest, cancellationToken);
                    product.ProductVariants.Add(newVariant);
                    activePairs.Add((newVariant.ColorId, newVariant.SizeId, newVariant.Id));
                }
            }

            AddAudit(userId, "Update", "Products", oldProduct, ProductAuditSnapshot(product));

            await _repository.SaveChangesAsync(cancellationToken);

            foreach (var variant in product.ProductVariants.Where(v => v.Id == 0 || v.CreatedAt == v.UpdatedAt))
            {
                if (variant.Id > 0)
                    AddAudit(userId, "Create", "ProductVariants", null, VariantAuditSnapshot(variant));

                if (variant.Id > 0 && variant.Stock > 0)
                {
                    _repository.AddInventoryLog(new InventoryLog
                    {
                        VariantId = variant.Id,
                        ChangeType = InventoryChangeType.InitialStock,
                        QuantityChanged = variant.Stock,
                        Reason = "Initial stock",
                        UserId = userId,
                        CreatedAt = DateTime.UtcNow
                    });
                }
            }

            await _repository.SaveChangesAsync(cancellationToken);
            await tx.CommitAsync(cancellationToken);

            var updated = await _repository.GetProductForAdminAsync(product.Id, cancellationToken);
            return ServiceResult<AdminProductDetailDto>.Success(ToDetailDto(updated!));
        }

        public async Task<ServiceResult<bool>> DeleteProductAsync(int id, int? userId, CancellationToken cancellationToken)
        {
            var product = await _repository.GetProductForAdminAsync(id, cancellationToken);
            if (product == null)
                return ServiceResult<bool>.Failure("Product not found.", StatusCodes.Status404NotFound);

            var oldProduct = ProductAuditSnapshot(product);
            product.IsDeleted = true;
            product.IsAvailable = false;
            product.DeletedAt = DateTime.UtcNow;
            product.UpdatedAt = DateTime.UtcNow;

            foreach (var variant in product.ProductVariants)
            {
                variant.IsDeleted = true;
                variant.IsAvailable = false;
                variant.DeletedAt = DateTime.UtcNow;
                variant.UpdatedAt = DateTime.UtcNow;
            }

            AddAudit(userId, "SoftDelete", "Products", oldProduct, ProductAuditSnapshot(product));
            await _repository.SaveChangesAsync(cancellationToken);

            return ServiceResult<bool>.Success(true, StatusCodes.Status204NoContent);
        }

        public async Task<ServiceResult<AdminProductDetailDto>> UpdateProductStatusAsync(int id, AdminProductStatusRequest request, int? userId, CancellationToken cancellationToken)
        {
            var product = await _repository.GetProductForAdminAsync(id, cancellationToken);
            if (product == null)
                return ServiceResult<AdminProductDetailDto>.Failure("Product not found.", StatusCodes.Status404NotFound);

            var oldProduct = ProductAuditSnapshot(product);
            product.IsAvailable = request.IsAvailable;
            product.UpdatedAt = DateTime.UtcNow;

            AddAudit(userId, "StatusChanged", "Products", oldProduct, ProductAuditSnapshot(product));
            await _repository.SaveChangesAsync(cancellationToken);

            return ServiceResult<AdminProductDetailDto>.Success(ToDetailDto(product));
        }

        public async Task<ServiceResult<AdminVariantDto>> UpdateVariantStockAsync(int id, AdminVariantStockRequest request, int? userId, CancellationToken cancellationToken)
        {
            var variant = await _repository.GetVariantForAdminAsync(id, cancellationToken);
            if (variant == null)
                return ServiceResult<AdminVariantDto>.Failure("Variant not found.", StatusCodes.Status404NotFound);

            var oldVariant = VariantAuditSnapshot(variant);
            var oldStock = variant.Stock;
            variant.Stock = request.Stock;
            variant.UpdatedAt = DateTime.UtcNow;

            _repository.AddInventoryLog(new InventoryLog
            {
                VariantId = variant.Id,
                ChangeType = InventoryChangeType.Adjusted,
                QuantityChanged = request.Stock - oldStock,
                Reason = string.IsNullOrWhiteSpace(request.Reason) ? "Admin stock adjustment" : request.Reason.Trim(),
                UserId = userId,
                CreatedAt = DateTime.UtcNow
            });

            AddAudit(userId, "StockChanged", "ProductVariants", oldVariant, VariantAuditSnapshot(variant));
            await _repository.SaveChangesAsync(cancellationToken);

            return ServiceResult<AdminVariantDto>.Success(ToVariantDto(variant));
        }

        public async Task<ServiceResult<AdminVariantDto>> UpdateVariantPriceAsync(int id, AdminVariantPriceRequest request, int? userId, CancellationToken cancellationToken)
        {
            var variant = await _repository.GetVariantForAdminAsync(id, cancellationToken);
            if (variant == null)
                return ServiceResult<AdminVariantDto>.Failure("Variant not found.", StatusCodes.Status404NotFound);

            var oldVariant = VariantAuditSnapshot(variant);
            variant.Price = request.Price;
            variant.UpdatedAt = DateTime.UtcNow;

            AddAudit(userId, "PriceChanged", "ProductVariants", oldVariant, VariantAuditSnapshot(variant));
            await _repository.SaveChangesAsync(cancellationToken);

            return ServiceResult<AdminVariantDto>.Success(ToVariantDto(variant));
        }

        private static string? ValidateProductCreate(AdminProductCreateRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Name)) return "Product name is required.";
            if (string.IsNullOrWhiteSpace(request.Description)) return "Product description is required.";
            if (request.BrandId == null && string.IsNullOrWhiteSpace(request.BrandName)) return "Brand is required.";
            if (request.Variants.Count == 0) return "Product must have at least one variant.";
            return ValidateVariantSet(request.Variants);
        }

        private static string? ValidateProductUpdate(AdminProductUpdateRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Name)) return "Product name is required.";
            if (string.IsNullOrWhiteSpace(request.Description)) return "Product description is required.";
            if (request.BrandId == null && string.IsNullOrWhiteSpace(request.BrandName)) return "Brand is required.";
            return ValidateVariantSet(request.Variants);
        }

        private static string? ValidateVariantSet(IEnumerable<AdminVariantCreateRequest> variants)
        {
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var variant in variants)
            {
                if (variant.Price <= 0) return "Variant price must be greater than 0.";
                if (variant.Stock < 0) return "Variant stock cannot be negative.";
                if (variant.ColorId == null && string.IsNullOrWhiteSpace(variant.ColorName)) return "Variant color is required.";
                if (variant.SizeId == null && string.IsNullOrWhiteSpace(variant.SizeName)) return "Variant size is required.";

                var key = $"{variant.ColorId?.ToString() ?? variant.ColorName?.Trim()}::{variant.SizeId?.ToString() ?? variant.SizeName?.Trim()}";
                if (!seen.Add(key))
                    return "Duplicate Color + Size variant is not allowed.";
            }

            return null;
        }

        private async Task<int?> ResolveBrandIdAsync(int? brandId, string? brandName, CancellationToken cancellationToken)
        {
            if (brandId.HasValue)
            {
                var brand = await _repository.GetBrandByIdAsync(brandId.Value, cancellationToken);
                if (brand == null)
                    throw new InvalidOperationException("Brand not found.");
                return brand.Id;
            }

            var normalized = brandName!.Trim();
            var existing = await _repository.GetBrandByNameAsync(normalized, cancellationToken);
            if (existing != null)
                return existing.Id;

            var newBrand = new Brand { Name = normalized, CreatedAt = DateTime.UtcNow };
            _repository.AddBrand(newBrand);
            await _repository.SaveChangesAsync(cancellationToken);
            return newBrand.Id;
        }

        private async Task<int> ResolveColorIdAsync(int? colorId, string? colorName, string? hexCode, CancellationToken cancellationToken)
        {
            if (colorId.HasValue)
            {
                var color = await _repository.GetColorByIdAsync(colorId.Value, cancellationToken);
                if (color == null)
                    throw new InvalidOperationException("Color not found.");
                return color.Id;
            }

            var normalized = colorName!.Trim();
            var existing = await _repository.GetColorByNameAsync(normalized, cancellationToken);
            if (existing != null)
                return existing.Id;

            var newColor = new Color { Name = normalized, HexCode = hexCode?.Trim() ?? string.Empty };
            _repository.AddColor(newColor);
            await _repository.SaveChangesAsync(cancellationToken);
            return newColor.Id;
        }

        private async Task<int> ResolveSizeIdAsync(int? sizeId, string? sizeName, CancellationToken cancellationToken)
        {
            if (sizeId.HasValue)
            {
                var size = await _repository.GetSizeByIdAsync(sizeId.Value, cancellationToken);
                if (size == null)
                    throw new InvalidOperationException("Size not found.");
                return size.Id;
            }

            var normalized = sizeName!.Trim();
            var existing = await _repository.GetSizeByNameAsync(normalized, cancellationToken);
            if (existing != null)
                return existing.Id;

            var newSize = new Size { Name = normalized };
            _repository.AddSize(newSize);
            await _repository.SaveChangesAsync(cancellationToken);
            return newSize.Id;
        }

        private async Task<ProductVariant> BuildNewVariantAsync(Product product, AdminVariantCreateRequest request, CancellationToken cancellationToken)
        {
            var colorId = await ResolveColorIdAsync(request.ColorId, request.ColorName, request.HexCode, cancellationToken);
            var sizeId = await ResolveSizeIdAsync(request.SizeId, request.SizeName, cancellationToken);

            var duplicate = product.ProductVariants.Any(v => !v.IsDeleted && v.ColorId == colorId && v.SizeId == sizeId);
            if (duplicate)
                throw new InvalidOperationException("Duplicate Color + Size variant is not allowed.");

            var colorName = request.ColorName;
            var sizeName = request.SizeName;

            if (string.IsNullOrWhiteSpace(colorName) && request.ColorId.HasValue)
                colorName = (await _repository.GetColorByIdAsync(request.ColorId.Value, cancellationToken))?.Name;

            if (string.IsNullOrWhiteSpace(sizeName) && request.SizeId.HasValue)
                sizeName = (await _repository.GetSizeByIdAsync(request.SizeId.Value, cancellationToken))?.Name;

            return new ProductVariant
            {
                Product = product,
                ColorId = colorId,
                SizeId = sizeId,
                Price = request.Price,
                Stock = request.Stock,
                Sku = BuildSku(product.Name, colorName ?? "COLOR", sizeName ?? "SIZE"),
                IsAvailable = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                Images = BuildVariantImages(request.ImageUrls)
            };
        }

        private static List<ProductImage> BuildProductImages(IEnumerable<string> urls)
        {
            return urls
                .Where(url => !string.IsNullOrWhiteSpace(url))
                .Select((url, index) => new ProductImage { Url = url.Trim(), SortOrder = index, CreatedAt = DateTime.UtcNow })
                .ToList();
        }

        private static List<ProductVariantImage> BuildVariantImages(IEnumerable<string> urls)
        {
            return urls
                .Where(url => !string.IsNullOrWhiteSpace(url))
                .Select((url, index) => new ProductVariantImage { Url = url.Trim(), SortOrder = index, CreatedAt = DateTime.UtcNow })
                .ToList();
        }

        private static string BuildSku(string productName, string colorName, string sizeName)
        {
            return $"{BuildProductCode(productName)}-{BuildColorCode(colorName)}-{NormalizeCode(sizeName, 8)}";
        }

        private static string BuildProductCode(string productName)
        {
            var skip = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "ao", "áo", "quan", "quần", "vay", "dam", "đầm" };
            var token = productName
                .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .FirstOrDefault(t => !skip.Contains(t)) ?? productName;

            return NormalizeCode(token, 10);
        }

        private static string BuildColorCode(string colorName)
        {
            var known = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["black"] = "BLK",
                ["white"] = "WHT",
                ["red"] = "RED",
                ["blue"] = "BLU",
                ["green"] = "GRN",
                ["yellow"] = "YLW",
                ["gray"] = "GRY",
                ["grey"] = "GRY",
                ["pink"] = "PNK",
                ["brown"] = "BRN",
                ["purple"] = "PUR"
            };

            return known.TryGetValue(colorName.Trim(), out var code) ? code : NormalizeCode(colorName, 3);
        }

        private static string NormalizeCode(string value, int maxLength)
        {
            var chars = value
                .Trim()
                .ToUpperInvariant()
                .Where(char.IsLetterOrDigit)
                .Take(maxLength)
                .ToArray();

            return chars.Length == 0 ? "SKU" : new string(chars);
        }

        private void AddAudit(int? userId, string action, string tableName, object? oldValues, object? newValues)
        {
            _repository.AddAuditLog(new AuditLog
            {
                UserId = userId,
                Action = action,
                TableName = tableName,
                OldValues = oldValues == null ? string.Empty : JsonSerializer.Serialize(oldValues),
                NewValues = newValues == null ? string.Empty : JsonSerializer.Serialize(newValues),
                CreatedAt = DateTime.UtcNow
            });
        }

        private static object ProductAuditSnapshot(Product product)
        {
            return new
            {
                product.Id,
                product.Name,
                product.Description,
                product.BrandId,
                product.CategoryId,
                product.Material,
                product.CareInstructions,
                product.IsFeatured,
                product.IsAvailable,
                product.IsDeleted,
                product.DeletedAt
            };
        }

        private static object VariantAuditSnapshot(ProductVariant variant)
        {
            return new
            {
                variant.Id,
                variant.ProductId,
                variant.ColorId,
                variant.SizeId,
                variant.Price,
                variant.Stock,
                variant.Sku,
                variant.IsAvailable,
                variant.IsDeleted,
                variant.DeletedAt
            };
        }

        private static AdminProductListItemDto ToListDto(Product product)
        {
            var variants = product.ProductVariants.Where(v => !v.IsDeleted).ToList();
            return new AdminProductListItemDto
            {
                Id = product.Id,
                Name = product.Name,
                Brand = product.Brand?.Name ?? string.Empty,
                Category = product.Category?.Name ?? string.Empty,
                MinPrice = variants.Count == 0 ? 0 : variants.Min(v => v.Price),
                TotalStock = variants.Sum(v => v.Stock),
                IsFeatured = product.IsFeatured,
                IsAvailable = product.IsAvailable,
                IsDeleted = product.IsDeleted,
                CreatedAt = product.CreatedAt,
                UpdatedAt = product.UpdatedAt
            };
        }

        private static AdminProductDetailDto ToDetailDto(Product product)
        {
            var list = ToListDto(product);
            return new AdminProductDetailDto
            {
                Id = list.Id,
                Name = list.Name,
                Brand = list.Brand,
                Category = list.Category,
                MinPrice = list.MinPrice,
                TotalStock = list.TotalStock,
                IsFeatured = list.IsFeatured,
                IsAvailable = list.IsAvailable,
                IsDeleted = list.IsDeleted,
                CreatedAt = list.CreatedAt,
                UpdatedAt = list.UpdatedAt,
                Description = product.Description,
                BrandId = product.BrandId,
                CategoryId = product.CategoryId,
                Material = product.Material,
                CareInstructions = product.CareInstructions,
                DeletedAt = product.DeletedAt,
                Images = product.Images.OrderBy(i => i.SortOrder).Select(ToImageDto).ToList(),
                Variants = product.ProductVariants.OrderBy(v => v.Color?.Name).ThenBy(v => v.Size?.Name).Select(ToVariantDto).ToList()
            };
        }

        private static AdminVariantDto ToVariantDto(ProductVariant variant)
        {
            return new AdminVariantDto
            {
                Id = variant.Id,
                ColorId = variant.ColorId,
                Color = variant.Color?.Name ?? string.Empty,
                HexCode = variant.Color?.HexCode ?? string.Empty,
                SizeId = variant.SizeId,
                Size = variant.Size?.Name ?? string.Empty,
                Price = variant.Price,
                Stock = variant.Stock,
                Sku = variant.Sku,
                IsAvailable = variant.IsAvailable,
                IsDeleted = variant.IsDeleted,
                Images = variant.Images.OrderBy(i => i.SortOrder).Select(ToImageDto).ToList()
            };
        }

        private static ProductImageDto ToImageDto(ProductImage image)
        {
            return new ProductImageDto { Id = image.Id, Url = image.Url, SortOrder = image.SortOrder };
        }

        private static ProductImageDto ToImageDto(ProductVariantImage image)
        {
            return new ProductImageDto { Id = image.Id, Url = image.Url, SortOrder = image.SortOrder };
        }
    }
}
