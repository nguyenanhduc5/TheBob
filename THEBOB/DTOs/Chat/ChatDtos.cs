namespace THEBOB.DTOs.Chat
{
    public class ChatMessageDto
    {
        public int Id { get; set; }
        public int ConversationId { get; set; }
        public string SenderType { get; set; } = string.Empty;
        public int? SenderId { get; set; }
        public string? SenderName { get; set; }
        public string Content { get; set; } = string.Empty;
        public string? ImageUrl { get; set; }
        public string MessageType { get; set; } = "Text";
        public int? ReferenceId { get; set; }
        public string? Metadata { get; set; }
        public DateTime CreatedAt { get; set; }
        public bool IsRead { get; set; }
    }

    public class ConversationListItemDto
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string? UserName { get; set; }
        public string? UserEmail { get; set; }
        public int? AssignedAdminId { get; set; }
        public string? AssignedAdminName { get; set; }
        public string Status { get; set; } = string.Empty;
        public string ChatMode { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public string? LastMessagePreview { get; set; }
        public int UnreadCount { get; set; }
    }

    public class SendChatMessageRequest
    {
        public string Content { get; set; } = string.Empty;
        public int? ConversationId { get; set; }
        public int? ProductId { get; set; }
        public int? VariantId { get; set; }
        public string? SelectedColor { get; set; }
        public string? SelectedSize { get; set; }
    }

    public class PagedMessagesResponse
    {
        public List<ChatMessageDto> Items { get; set; } = new();
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int TotalCount { get; set; }
        public bool HasMore { get; set; }
    }
}
