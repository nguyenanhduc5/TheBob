namespace THEBOB.Exceptions
{
    /// <summary>
    /// Ngo?i l? ném ra khi ngu?i dùng không d? quy?n truy c?p (HTTP 403 Forbidden).
    /// </summary>
    public class ForbiddenException : AppException
    {
        public ForbiddenException(string message = "B?n không có quy?n truy c?p vào tài nguyên này.") 
            : base(message, 403)
        {
        }
    }
}
