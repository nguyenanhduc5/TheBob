using System.Threading.Channels;

namespace THEBOB.Services.Background
{
    public class AiChatJob
    {
        public int ConversationId { get; set; }
        public int UserId { get; set; }
        public string Content { get; set; } = string.Empty;
    }

    public class BlogClickJob
    {
        public int BlogPostId { get; set; }
        public int? UserId { get; set; }
        public string? SessionId { get; set; }
        public string Source { get; set; } = "Direct";
        public int? ProductId { get; set; }
    }
}
