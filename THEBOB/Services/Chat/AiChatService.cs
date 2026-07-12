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

        public async Task<string> GenerateReplyAsync(string systemPrompt, List<(string role, string content)> history, string userMessage)
        {
            try
            {
                var apiKey = _configuration["OpenAI:ApiKey"];
                var model = _configuration["OpenAI:Model"] ?? "gpt-4o-mini";
                var baseUrl = _configuration["OpenAI:BaseUrl"] ?? "https://api.openai.com/v1/chat/completions";

                if (string.IsNullOrWhiteSpace(apiKey) || apiKey.StartsWith("YOUR_OPENAI_"))
                {
                    _logger.LogWarning("OpenAI API Key is missing or invalid.");
                    return "Xin lỗi, hệ thống đang bận, vui lòng thử lại sau hoặc chờ nhân viên hỗ trợ.";
                }

                _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

                var messages = new List<object>
                {
                    new { role = "system", content = systemPrompt }
                };

                foreach (var (role, content) in history)
                {
                    messages.Add(new { role, content });
                }

                messages.Add(new { role = "user", content = userMessage });

                var payload = new
                {
                    model = model,
                    messages = messages,
                    temperature = 0.7
                };

                var contentJson = JsonSerializer.Serialize(payload);
                var requestContent = new StringContent(contentJson, Encoding.UTF8, "application/json");

                using var response = await _httpClient.PostAsync(baseUrl, requestContent);
                
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
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception while calling OpenAI API.");
                return "Xin lỗi, hệ thống đang bận, vui lòng thử lại sau hoặc chờ nhân viên hỗ trợ.";
            }
        }
    }
}
