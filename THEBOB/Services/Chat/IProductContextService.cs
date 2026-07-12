using THEBOB.DTOs.Chat;
using System.Threading.Tasks;

namespace THEBOB.Services.Chat
{
    public interface IProductContextService
    {
        Task<ProductContextDto?> BuildContextAsync(int productId);
    }
}
