namespace THEBOB.Services
{
    public class ServiceResult<T>
    {
        public bool Succeeded { get; private set; }
        public int StatusCode { get; private set; }
        public string? Error { get; private set; }
        public T? Value { get; private set; }

        public static ServiceResult<T> Success(T value, int statusCode = StatusCodes.Status200OK)
        {
            return new ServiceResult<T> { Succeeded = true, StatusCode = statusCode, Value = value };
        }

        public static ServiceResult<T> Failure(string error, int statusCode)
        {
            return new ServiceResult<T> { Succeeded = false, StatusCode = statusCode, Error = error };
        }
    }
}
