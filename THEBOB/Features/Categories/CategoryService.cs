using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using THEBOB.Data;
using THEBOB.Models;
using THEBOB.Exceptions;

namespace THEBOB.Services
{
    public class CategoryService : ICategoryService
    {
        private readonly ThebobDbContext _context;

        public CategoryService(ThebobDbContext context)
        {
            _context = context;
        }

        public async Task<List<Category>> GetCategoriesAsync()
        {
            return await _context.Categories
                .Where(c => !c.IsDeleted)
                .OrderBy(c => c.Name)
                .ToListAsync();
        }

        public async Task<Category> GetCategoryByIdAsync(int id)
        {
            return await _context.Categories
                .FirstOrDefaultAsync(c => c.Id == id && !c.IsDeleted)
                ?? throw new NotFoundException($"Không tìm thấy danh mục #{id}.");
        }

        public async Task<Category> CreateCategoryAsync(string name, string? description)
        {
            var category = new Category
            {
                Name = name.Trim(),
                Description = description?.Trim() ?? string.Empty,
                Slug = GenerateSlug(name)
            };

            _context.Categories.Add(category);
            await _context.SaveChangesAsync();
            return category;
        }

        public async Task<Category> UpdateCategoryAsync(int id, string name, string? description)
        {
            var existingCategory = await _context.Categories.FindAsync(id);
            if (existingCategory == null || existingCategory.IsDeleted)
                throw new NotFoundException($"Không tìm thấy danh mục #{id}.");

            existingCategory.Name = name.Trim();
            existingCategory.Description = description?.Trim() ?? string.Empty;
            existingCategory.Slug = GenerateSlug(name);
            existingCategory.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return existingCategory;
        }

        public async Task DeleteCategoryAsync(int id)
        {
            var category = await _context.Categories.FindAsync(id);
            if (category == null || category.IsDeleted)
                throw new NotFoundException($"Không tìm thấy danh mục #{id}.");

            var hasProducts = await _context.Products.AnyAsync(p => p.CategoryId == id && !p.IsDeleted);
            if (hasProducts)
                throw new ConflictException("Không thể xóa danh mục đang có sản phẩm liên kết.");

            category.IsDeleted = true;
            category.DeletedAt = DateTime.UtcNow;
            category.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }

        private static string GenerateSlug(string name)
        {
            return name.Trim().ToLower().Replace(' ', '-').Replace("--", "-");
        }
    }
}
