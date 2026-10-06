using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace THEBOB.Services.Chat
{
    public class AiChatService : IAiChatService
    {
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;
        private readonly ILogger<AiChatService> _logger;

        public AiChatService(HttpClient httpClient, IConfiguration configuration, ILogger<AiChatService> logger)
        {
            _httpClient = httpClient;
            _configuration = configuration;
            _logger = logger;
        }

        // Giới hạn độ dài tin nhắn gửi lên AI để tránh payload quá lớn và timeout
        private const int MaxUserMessageChars = 800;
        private const int MaxTotalHistoryChars = 2000;

        public async Task<string> GenerateReplyAsync(string systemPrompt, List<(string role, string content)> history, string userMessage)
        {
            try
            {
                var apiKey = _configuration["OpenAI:ApiKey"];
                var model = _configuration["OpenAI:Model"] ?? "gpt-4o-mini";
                var baseUrl = _configuration["OpenAI:BaseUrl"] ?? "https://api.openai.com/v1/chat/completions";
                var maxTokens = int.TryParse(_configuration["OpenAI:MaxTokens"], out var mt) ? mt : 400;
                var timeoutSeconds = int.TryParse(_configuration["OpenAI:TimeoutSeconds"], out var ts) ? ts : 20;

                if (string.IsNullOrWhiteSpace(apiKey) || apiKey.StartsWith("YOUR_OPENAI_"))
                {
                    _logger.LogWarning("OpenAI API Key is missing or invalid.");
                    return "Xin lỗi, hệ thống đang bận, vui lòng thử lại sau hoặc chờ nhân viên hỗ trợ.";
                }

                _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

                // Cắt ngắn tin nhắn người dùng nếu quá dài (tránh tốn quá nhiều token đầu vào)
                var truncatedUserMessage = userMessage.Length > MaxUserMessageChars
                    ? userMessage[..MaxUserMessageChars] + "..."
                    : userMessage;

                if (userMessage.Length > MaxUserMessageChars)
                    _logger.LogInformation("User message truncated from {Original} to {Max} chars for AI.", userMessage.Length, MaxUserMessageChars);

                // Cắt ngắn lịch sử hội thoại nếu tổng quá dài (chỉ giữ các tin nhắn mới nhất)
                var trimmedHistory = new List<(string role, string content)>();
                int totalHistoryChars = 0;
                for (int i = history.Count - 1; i >= 0; i--)
                {
                    totalHistoryChars += history[i].content.Length;
                    if (totalHistoryChars > MaxTotalHistoryChars) break;
                    trimmedHistory.Insert(0, history[i]);
                }

                var messages = new List<object>
                {
                    new { role = "system", content = systemPrompt }
                };

                foreach (var (role, content) in trimmedHistory)
                {
                    messages.Add(new { role, content });
                }

                messages.Add(new { role = "user", content = truncatedUserMessage });

                var payload = new
                {
                    model = model,
                    messages = messages,
                    temperature = 0.7,
                    max_tokens = maxTokens  // Giới hạn độ dài phản hồi của AI
                };

                var contentJson = JsonSerializer.Serialize(payload);
                var requestContent = new StringContent(contentJson, Encoding.UTF8, "application/json");

                // Đặt timeout cứng cho từng request OpenAI — tránh treo 100 giây (default HttpClient)
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(timeoutSeconds));
                using var response = await _httpClient.PostAsync(baseUrl, requestContent, cts.Token);
                
                if (!response.IsSuccessStatusCode)
                {
                    var errorDetails = await response.Content.ReadAsStringAsync();
                    _logger.LogError("OpenAI API Error: {StatusCode} - {ErrorDetails}", response.StatusCode, errorDetails);
                    return "Xin lỗi, hệ thống đang bận, vui lòng thử lại sau hoặc chờ nhân viên hỗ trợ.";
                }

                var responseString = await response.Content.ReadAsStringAsync();
                using var jsonDoc = JsonDocument.Parse(responseString);
                var root = jsonDoc.RootElement;

                if (root.TryGetProperty("choices", out var choices) && choices.GetArrayLength() > 0)
                {
                    var firstChoice = choices[0];
                    if (firstChoice.TryGetProperty("message", out var message) && message.TryGetProperty("content", out var replyContent))
                    {
                        return replyContent.GetString() ?? string.Empty;
                    }
                }

                _logger.LogWarning("Unexpected response format from OpenAI.");
                return "Xin lỗi, hệ thống đang bận, vui lòng thử lại sau hoặc chờ nhân viên hỗ trợ.";
            }
            catch (OperationCanceledException)
            {
                // Timeout sau N giây — không để người dùng chờ vô thời hạn
                _logger.LogWarning("OpenAI API call timed out after {TimeoutSeconds}s.", _configuration["OpenAI:TimeoutSeconds"] ?? "20");
                return "Hệ thống AI đang bận, vui lòng gửi lại câu hỏi ngắn hơn hoặc chờ nhân viên hỗ trợ.";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception while calling OpenAI API.");
                return "Xin lỗi, hệ thống đang bận, vui lòng thử lại sau hoặc chờ nhân viên hỗ trợ.";
            }
        }
    }
}
