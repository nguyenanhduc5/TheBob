using THEBOB.Controllers;
using THEBOB.Models;

namespace THEBOB.Services
{
    public interface IProductService
    {
        Task<List<object>> GetProductsAsync();
        Task<(bool Success, string Message, int StatusCode, object? Data)> GetProductAsync(string identifier);
        Task<List<Category>> GetCategoriesAsync();
        Task<List<Brand>> GetBrandsAsync();
        Task<List<Size>> GetSizesAsync();
        Task<List<Color>> GetColorsAsync();
        Task<(bool Success, string Message, int StatusCode, Color? Data)> CreateColorAsync(Color color);
        Task<(bool Success, string Message, int StatusCode, Color? Data)> UpdateColorAsync(int id, Color color);
        Task<(bool Success, string Message, int StatusCode)> DeleteColorAsync(int id);
        Task<(bool Success, string Message, int StatusCode, Size? Data)> CreateSizeAsync(Size size);
        Task<(bool Success, string Message, int StatusCode, Size? Data)> UpdateSizeAsync(int id, Size size);
        Task<(bool Success, string Message, int StatusCode)> DeleteSizeAsync(int id);
        Task<(bool Success, string Message, int StatusCode, object? Data)> CreateProductAsync(ProductCreateRequest request);
        Task<(bool Success, string Message, int StatusCode)> UpdateProductAsync(int id, ProductUpdateRequest request);
        Task<(bool Success, string Message, int StatusCode)> DeleteProductAsync(int id);
        Task<List<object>> SearchAsync(string? query, int? categoryId, string? color, decimal? minPrice, decimal? maxPrice);
    }
}
