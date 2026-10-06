namespace THEBOB.Exceptions
{
    /// <summary>
    /// Ngo?i l? ném ra khi d? li?u b? xung d?t ho?c trùng l?p (HTTP 409 Conflict).
    /// </summary>
    public class ConflictException : AppException
    {
        public ConflictException(string message = "D? li?u b? xung d?t v?i tr?ng thái hi?n t?i c?a h? th?ng.") 
            : base(message, 409)
        {
        }
    }
}
