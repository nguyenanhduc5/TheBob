namespace THEBOB.Exceptions
{
    /// <summary>
    /// L?p ngo?i l? co s? cho toàn b? h? th?ng THEBOB.
    /// Cho phép g?n kèm HTTP StatusCode và danh sách l?i chi ti?t (Errors).
    /// </summary>
    public class AppException : Exception
    {
        public int StatusCode { get; }
        public object? Errors { get; }

        public AppException(string message, int statusCode = 400, object? errors = null) 
            : base(message)
        {
            StatusCode = statusCode;
            Errors = errors;
        }
    }
}
