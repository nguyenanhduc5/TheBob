namespace THEBOB.Models.LiveChat
{
    public enum ChatMode
    {
        AI = 0,
        Admin = 1,
        Hybrid = 2
    }

    public enum ConversationStatus
    {
        Open = 0,
        Closed = 1
    }

    public enum SenderType
    {
        User = 0,
        Admin = 1,
        AI = 2,
        System = 3
    }
}
