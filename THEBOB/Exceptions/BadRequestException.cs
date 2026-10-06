namespace THEBOB.Exceptions
{
    /// <summary>
    /// Ngo?i l? ném ra khi d? li?u d?u vào ho?c thao tác không h?p l? (HTTP 400 Bad Request).
    /// </summary>
    public class BadRequestException : AppException
    {
        public BadRequestException(string message, object? errors = null) 
            : base(message, 400, errors)
        {
        }
    }
}
