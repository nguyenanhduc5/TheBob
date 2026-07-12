using THEBOB.Models.LiveChat;

namespace THEBOB.Services.Chat
{
    public interface IFaqService
    {
        Task<Faq?> TryMatchFaqAsync(string userMessage);
    }
}
