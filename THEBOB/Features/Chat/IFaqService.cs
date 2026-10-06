using THEBOB.Models.LiveChat;

namespace THEBOB.Services.Chat
{
    public interface IFaqService
    {
        Task<Faq?> TryMatchFaqAsync(string userMessage);
        Task<List<Faq>> GetAllFaqsAsync();
        Task<Faq> CreateFaqAsync(Faq faq);
        Task<Faq?> UpdateFaqAsync(int id, Faq faq);
        Task<bool> DeleteFaqAsync(int id);
    }
}
