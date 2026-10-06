namespace THEBOB.Models.Blog
{
    public enum BlogStatus
    {
        Draft = 0,
        Published = 1,
        Archived = 2
    }

    public enum MessageType
    {
        Text = 0,
        BlogPost = 1,
        Product = 2,
        Image = 3
    }

    public enum BlogNotificationTargetType
    {
        All = 0,
        Segment = 1,
        Manual = 2
    }

    public enum BlogClickSource
    {
        Home = 0,
        Notification = 1,
        Chat = 2,
        Direct = 3
    }
}
