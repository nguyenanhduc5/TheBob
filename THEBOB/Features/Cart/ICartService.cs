using System.Collections.Generic;
using System.Threading.Tasks;
using THEBOB.Controllers;
using THEBOB.Models;

namespace THEBOB.Services
{
    public interface ICartService
    {
        Task<Cart?> GetCartAsync(int userId);
        Task<(bool Success, string Message, int AvailableStock, int StatusCode)> AddToCartAsync(int userId, AddToCartRequest request);
        Task<object> SyncCartAsync(int userId, SyncCartRequest request);
        Task<(bool Success, string Message, int AvailableStock, int StatusCode)> UpdateCartItemAsync(int userId, int itemId, UpdateCartItemRequest request);
        Task<(bool Success, string Message, int StatusCode)> RemoveCartItemAsync(int userId, int itemId);
        Task<bool> ClearCartAsync(int userId);
    }
}
