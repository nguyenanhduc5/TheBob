namespace THEBOB.Exceptions
{
    /// <summary>
    /// Ngo?i l? ném ra khi không tìm th?y tài nguyên (HTTP 404 Not Found).
    /// </summary>
    public class NotFoundException : AppException
    {
        public NotFoundException(string message = "Không tìm th?y tài nguyên yêu c?u.") 
            : base(message, 404)
        {
        }
    }
}
