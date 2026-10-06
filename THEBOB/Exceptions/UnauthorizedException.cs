namespace THEBOB.Exceptions
{
    /// <summary>
    /// Ngo?i l? ném ra khi chua xác th?c ho?c token không h?p l? (HTTP 401 Unauthorized).
    /// </summary>
    public class UnauthorizedException : AppException
    {
        public UnauthorizedException(string message = "B?n chua dang nh?p ho?c phiên dang nh?p dã h?t h?n.") 
            : base(message, 401)
        {
        }
    }
}
