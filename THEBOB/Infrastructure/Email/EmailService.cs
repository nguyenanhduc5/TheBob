using SendGrid;
using SendGrid.Helpers.Mail;
using Microsoft.Extensions.Configuration;
using System;
using System.Threading.Tasks;

namespace THEBOB.Services
{
    public interface IEmailService
    {
        Task<bool> SendEmailAsync(string toEmail, string subject, string content);
    }

    public class EmailService : IEmailService
    {
        private readonly IConfiguration _configuration;

        public EmailService(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public async Task<bool> SendEmailAsync(string toEmail, string subject, string content)
        {
            var env = _configuration["ASPNETCORE_ENVIRONMENT"] ?? Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production";
            var isDevelopment = env.Equals("Development", StringComparison.OrdinalIgnoreCase);

            try
            {
                var apiKey = _configuration["SendGrid:ApiKey"] ?? _configuration["SendGrid__ApiKey"];
                
                // If API Key is missing, print to console in development and succeed, or fail in production
                if (string.IsNullOrEmpty(apiKey) || apiKey.Equals("YOUR_SENDGRID_API_KEY", StringComparison.OrdinalIgnoreCase))
                {
                    if (isDevelopment)
                    {
                        PrintMockEmail(toEmail, subject, content);
                        return true;
                    }
                    Console.WriteLine("[EmailService] SendGrid ApiKey is missing from configuration.");
                    return false;
                }

                var client = new SendGridClient(apiKey);
                var fromEmail = _configuration["SendGrid:FromEmail"] ?? "noreply@thebob.com";
                var fromName = _configuration["SendGrid:FromName"] ?? "THEBOB Store";
                
                var from = new EmailAddress(fromEmail, fromName);
                var to = new EmailAddress(toEmail);
                
                // Create single email with HTML content
                var msg = MailHelper.CreateSingleEmail(from, to, subject, content, content);
                var response = await client.SendEmailAsync(msg);
                
                if (!response.IsSuccessStatusCode)
                {
                    var responseBody = await response.Body.ReadAsStringAsync();
                    Console.WriteLine($"[EmailService] Failed to send email via SendGrid. Status: {response.StatusCode}, Body: {responseBody}");
                    
                    if (isDevelopment)
                    {
                        PrintMockEmail(toEmail, subject, content, "SendGrid Error Fallback");
                        return true;
                    }
                    return false;
                }
                
                return true;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[EmailService] Exception occurred while sending email: {ex.Message}");
                if (isDevelopment)
                {
                    PrintMockEmail(toEmail, subject, content, $"Exception Fallback: {ex.Message}");
                    return true;
                }
                return false;
            }
        }

        private void PrintMockEmail(string toEmail, string subject, string content, string fallbackReason = "")
        {
            Console.WriteLine("====================================================================");
            Console.WriteLine($"[MOCK EMAIL SERVICE] {fallbackReason}");
            Console.WriteLine($"To: {toEmail}");
            Console.WriteLine($"Subject: {subject}");
            Console.WriteLine("--------------------------------------------------------------------");
            
            // Extract the OTP code for easy copy-paste from output
            var otpCode = "";
            var otpStartIndex = content.IndexOf("letter-spacing: 5px; color: #4F46E5;");
            if (otpStartIndex != -1)
            {
                var nextTagClose = content.IndexOf(">", otpStartIndex);
                if (nextTagClose != -1)
                {
                    var endTag = content.IndexOf("</span>", nextTagClose);
                    if (endTag != -1)
                    {
                        otpCode = content.Substring(nextTagClose + 1, endTag - nextTagClose - 1).Trim();
                    }
                }
            }

            if (!string.IsNullOrEmpty(otpCode))
            {
                Console.WriteLine($">>> MOCK OTP CODE: {otpCode} <<<");
                try
                {
                    // Write to otp.txt in the workspace root for local developer convenience
                    System.IO.File.WriteAllText("c:\\THEBOB\\otp.txt", $"Email: {toEmail}\nOTP: {otpCode}\nSent at: {DateTime.Now}");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Failed to write OTP to file: {ex.Message}");
                }
            }
            else
            {
                Console.WriteLine($"Body: {content}");
            }
            Console.WriteLine("====================================================================");
        }
    }
}
