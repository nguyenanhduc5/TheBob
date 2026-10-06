using SendGrid;
using SendGrid.Helpers.Mail;

namespace THEBOB.Services
{
    public interface IEmailService
    {
        Task<bool> SendEmailAsync(string toEmail, string subject, string htmlContent);
    }

    public class EmailService : IEmailService
    {
        private readonly IConfiguration _config;
        private readonly ILogger<EmailService> _logger;

        public EmailService(IConfiguration config, ILogger<EmailService> logger)
        {
            _config = config;
            _logger = logger;
        }

        public async Task<bool> SendEmailAsync(string toEmail, string subject, string htmlContent)
        {
            var apiKey = _config["SendGrid:ApiKey"];
            var fromEmail = _config["SendGrid:FromEmail"];

            if (string.IsNullOrWhiteSpace(apiKey) || string.IsNullOrWhiteSpace(fromEmail))
            {
                _logger.LogError("SendGrid chưa cấu hình đầy đủ (thiếu ApiKey hoặc FromEmail trong appsettings.json).");
                return false;
            }

            var client = new SendGridClient(apiKey);

            var msg = new SendGridMessage
            {
                From = new EmailAddress(fromEmail, "THEBOB"),
                Subject = subject,
                HtmlContent = htmlContent,
            };
            msg.AddTo(new EmailAddress(toEmail));

            var response = await client.SendEmailAsync(msg);

            if ((int)response.StatusCode >= 200 && (int)response.StatusCode < 300)
            {
                _logger.LogInformation("Đã gửi email tới {Email}, status {Status}", toEmail, response.StatusCode);
                return true;
            }

            var body = await response.Body.ReadAsStringAsync();
            _logger.LogError(
                "SendGrid gửi thất bại tới {Email}. Status: {Status}. Body: {Body}",
                toEmail, response.StatusCode, body
            );
            return false;
        }
    }
}