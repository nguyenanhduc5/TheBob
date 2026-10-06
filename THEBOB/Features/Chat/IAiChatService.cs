using System.Collections.Generic;
using System.Threading.Tasks;

namespace THEBOB.Services.Chat
{
    public interface IAiChatService
    {
        Task<string> GenerateReplyAsync(string systemPrompt, List<(string role, string content)> history, string userMessage);
    }
}
