using System.Collections.Generic;
using System.Threading.Tasks;
using THEBOB.Models;

namespace THEBOB.Services
{
    public interface ICategoryService
    {
        Task<List<Category>> GetCategoriesAsync();
        Task<Category> GetCategoryByIdAsync(int id);
        Task<Category> CreateCategoryAsync(string name, string? description);
        Task<Category> UpdateCategoryAsync(int id, string name, string? description);
        Task DeleteCategoryAsync(int id);
    }
}
