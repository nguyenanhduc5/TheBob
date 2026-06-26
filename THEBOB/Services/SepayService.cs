using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using THEBOB.Models;

namespace THEBOB.Services
{
    public class SepayService
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<SepayService> _logger;
        private readonly IConfiguration _configuration;

        public SepayService(
            IHttpClientFactory httpClientFactory,
            ILogger<SepayService> logger,
            IConfiguration configuration)
        {
            _httpClientFactory = httpClientFactory;
            _logger = logger;
            _configuration = configuration;
        }

        public async Task<SepayVirtualAccountResult> CreateVirtualAccount(int orderId, decimal amount)
        {
            var apiToken = GetRequiredConfig("SePay:ApiToken");
            var vaPrefix = GetRequiredConfig("SePay:VaPrefix");
            var baseUrl = GetRequiredConfig("SePay:BaseUrl").TrimEnd('/');
            var orderCode = $"THEBOB{orderId}";
            var fallbackVaNumber = $"{vaPrefix}{orderId}";

            var client = CreateClient(baseUrl, apiToken);

            try
            {
                var baUuid = await ResolveBankAccountUuid(client);
                if (string.IsNullOrWhiteSpace(baUuid))
                {
                    _logger.LogWarning("SePay Bank Account UUID could not be resolved for OrderId={OrderId}.", orderId);
                    return BuildFallbackVirtualAccount(orderId, amount, fallbackVaNumber, orderCode, "Could not resolve bank account UUID");
                }

                var payload = new
                {
                    amount = decimal.ToInt64(decimal.Round(amount, 0, MidpointRounding.AwayFromZero)),
                    order_code = orderCode,
                    va_prefix = vaPrefix,
                    duration = 900,
                    with_qrcode = 1
                };

                using var response = await client.PostAsync(
                    $"bank-accounts/{baUuid}/orders",
                    new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json"));

                var responseText = await response.Content.ReadAsStringAsync();
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning(
                        "SePay CreateVirtualAccount (v2 orders) returned {StatusCode} for OrderId={OrderId}. Body={Body}",
                        response.StatusCode,
                        orderId,
                        responseText);

                    return BuildFallbackVirtualAccount(orderId, amount, fallbackVaNumber, orderCode, responseText);
                }

                using var document = JsonDocument.Parse(responseText);
                var root = document.RootElement;
                var data = root.TryGetProperty("data", out var dataElement) ? dataElement : root;
                
                var vaNumber = GetString(data, "va_number", "vaNumber", "virtualAccount") ?? fallbackVaNumber;

                return new SepayVirtualAccountResult
                {
                    Success = true,
                    VaNumber = vaNumber,
                    Amount = amount,
                    BankName = GetString(data, "bank_name", "bankName", "bank") ?? "SePay",
                    BankAccount = vaNumber,
                    AccountName = GetString(data, "account_holder_name", "va_holder_name", "accountName", "name") ?? "THEBOB",
                    TransferContent = GetString(data, "order_code", "transferContent", "content") ?? orderCode,
                    QrCode = GetString(data, "qr_code_url", "qr_code", "qrUrl", "qr_url") ?? BuildQrUrl(vaNumber, amount, orderCode),
                    RawResponse = responseText
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "SePay CreateVirtualAccount failed for OrderId={OrderId}", orderId);
                return BuildFallbackVirtualAccount(orderId, amount, fallbackVaNumber, orderCode, ex.Message);
            }
        }

        public async Task<SepayTransactionStatusResult> GetTransactionStatus(string vaNumber)
        {
            var apiToken = GetRequiredConfig("SePay:ApiToken");
            var baseUrl = GetRequiredConfig("SePay:BaseUrl").TrimEnd('/');
            var client = CreateClient(baseUrl, apiToken);

            try
            {
                using var response = await client.GetAsync($"transactions?va_number={Uri.EscapeDataString(vaNumber)}");
                var responseText = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("SePay GetTransactionStatus failed for VA={VaNumber}: {StatusCode} {Body}", vaNumber, response.StatusCode, responseText);
                    return new SepayTransactionStatusResult { Status = "Pending", RawResponse = responseText };
                }

                using var document = JsonDocument.Parse(responseText);
                var data = document.RootElement.TryGetProperty("data", out var dataElement) ? dataElement : document.RootElement;

                return new SepayTransactionStatusResult
                {
                    Status = GetString(data, "status", "paymentStatus") ?? "Pending",
                    TransactionId = GetString(data, "transactionId", "transaction_id", "id", "referenceCode"),
                    RawResponse = responseText
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "SePay GetTransactionStatus exception for VA={VaNumber}", vaNumber);
                return new SepayTransactionStatusResult { Status = "Pending", RawResponse = ex.Message };
            }
        }

        public bool VerifyWebhook(HttpRequest request, out string error)
        {
          var expectedToken = _configuration["SePay:WebhookSecret"] 
                    ?? GetRequiredConfig("SePay:ApiToken");
            var authorization = request.Headers.Authorization.ToString();

           if (string.IsNullOrWhiteSpace(authorization))
{
    error = "Missing Authorization Bearer token.";
    return false;
}

string actualToken;
if (authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
    actualToken = authorization["Bearer ".Length..].Trim();
else if (authorization.StartsWith("Apikey ", StringComparison.OrdinalIgnoreCase))
    actualToken = authorization["Apikey ".Length..].Trim();
else
{
    error = "Missing Authorization Bearer token.";
    return false;
}
            if (!string.Equals(actualToken, expectedToken, StringComparison.Ordinal))
            {
                error = "Invalid SePay webhook token.";
                return false;
            }

            error = string.Empty;
            return true;
        }

        public SepayWebhookPayload ParseWebhook(JsonElement payload)
        {
            var data = payload.TryGetProperty("data", out var dataElement) ? dataElement : payload;
            return new SepayWebhookPayload
            {
                TransactionId = GetString(data, "transactionId", "transaction_id", "id", "referenceCode", "reference_code"),
                VaNumber = GetString(data, "vaNumber", "va_number", "virtualAccount", "virtual_account", "subAccount", "accountNumber", "account_number"),
                TransferContent = GetString(data, "transferContent", "transfer_content", "content", "description", "note"),
                Amount = GetDecimal(data, "amount", "transferAmount", "transfer_amount"),
                Status = GetString(data, "status", "paymentStatus") ?? "Paid",
                PaidAt = GetDateTime(data, "paidAt", "paid_at", "transactionDate", "transaction_date") ?? DateTime.UtcNow
            };
        }

        private HttpClient CreateClient(string baseUrl, string token)
        {
            var client = _httpClientFactory.CreateClient("SePay");
            client.BaseAddress = new Uri($"{baseUrl}/");
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
            client.DefaultRequestHeaders.Accept.Clear();
            client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            return client;
        }

        private string GetRequiredConfig(string key)
        {
            var value = _configuration[key];
            if (string.IsNullOrWhiteSpace(value))
                throw new InvalidOperationException($"Missing configuration: {key}");
            return value;
        }

        private SepayVirtualAccountResult BuildFallbackVirtualAccount(
            int orderId,
            decimal amount,
            string vaNumber,
            string transferContent,
            string rawResponse)
        {
            _logger.LogWarning("Using deterministic SePay VA fallback for OrderId={OrderId}, VA={VaNumber}", orderId, vaNumber);
            return new SepayVirtualAccountResult
            {
                Success = true,
                VaNumber = vaNumber,
                Amount = amount,
                BankName = "SePay",
                BankAccount = vaNumber,
                AccountName = "THEBOB",
                TransferContent = transferContent,
                QrCode = BuildQrUrl(vaNumber, amount, transferContent),
                RawResponse = rawResponse
            };
        }

        public string GetBankBin()
        {
            var value = _configuration["SePay:BankBin"];
            return string.IsNullOrWhiteSpace(value) ? "970403" : value;
        }

        private async Task<string> ResolveBankAccountUuid(HttpClient client)
        {
            var configuredUuid = _configuration["SePay:BankAccountUuid"];
            if (!string.IsNullOrWhiteSpace(configuredUuid))
            {
                return configuredUuid;
            }

            try
            {
                using var response = await client.GetAsync("bank-accounts");
                if (response.IsSuccessStatusCode)
                {
                    var responseText = await response.Content.ReadAsStringAsync();
                    using var document = JsonDocument.Parse(responseText);
                    if (document.RootElement.TryGetProperty("data", out var dataElement) &&
                        dataElement.ValueKind == JsonValueKind.Array &&
                        dataElement.GetArrayLength() > 0)
                    {
                        var firstAccount = dataElement[0];
                        if (firstAccount.TryGetProperty("id", out var idProp))
                        {
                            return idProp.GetString() ?? string.Empty;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to dynamically resolve SePay bank account UUID");
            }

            return string.Empty;
        }

        private string BuildQrUrl(string vaNumber, decimal amount, string content)
        {
            var bankBin = GetBankBin();
            var amountInt = decimal.ToInt64(decimal.Round(amount, 0, MidpointRounding.AwayFromZero));
            return $"https://img.vietqr.io/image/{bankBin}-{Uri.EscapeDataString(vaNumber)}-compact.png?amount={amountInt}&addInfo={Uri.EscapeDataString(content)}&accountName={Uri.EscapeDataString("THEBOB")}";
        }

        private static string? GetString(JsonElement element, params string[] names)
        {
            foreach (var name in names)
            {
                if (element.ValueKind == JsonValueKind.Object && element.TryGetProperty(name, out var property))
                {
                    if (property.ValueKind == JsonValueKind.String) return property.GetString();
                    if (property.ValueKind == JsonValueKind.Number) return property.GetRawText();
                }
            }
            return null;
        }

        private static decimal GetDecimal(JsonElement element, params string[] names)
        {
            foreach (var name in names)
            {
                if (element.ValueKind != JsonValueKind.Object || !element.TryGetProperty(name, out var property))
                    continue;

                if (property.ValueKind == JsonValueKind.Number && property.TryGetDecimal(out var value))
                    return value;

                if (property.ValueKind == JsonValueKind.String && decimal.TryParse(property.GetString(), out value))
                    return value;
            }
            return 0;
        }

        private static DateTime? GetDateTime(JsonElement element, params string[] names)
        {
            foreach (var name in names)
            {
                if (element.ValueKind == JsonValueKind.Object &&
                    element.TryGetProperty(name, out var property) &&
                    property.ValueKind == JsonValueKind.String &&
                    DateTime.TryParse(property.GetString(), out var value))
                {
                    return value.ToUniversalTime();
                }
            }
            return null;
        }
    }

    public class SepayVirtualAccountResult
    {
        public bool Success { get; set; }
        public string VaNumber { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public string BankName { get; set; } = string.Empty;
        public string BankAccount { get; set; } = string.Empty;
        public string AccountName { get; set; } = string.Empty;
        public string TransferContent { get; set; } = string.Empty;
        public string QrCode { get; set; } = string.Empty;
        public string RawResponse { get; set; } = string.Empty;
    }

    public class SepayTransactionStatusResult
    {
        public string Status { get; set; } = "Pending";
        public string? TransactionId { get; set; }
        public string RawResponse { get; set; } = string.Empty;
    }

    public class SepayWebhookPayload
    {
        public string? TransactionId { get; set; }
        public string? VaNumber { get; set; }
        public string? TransferContent { get; set; }
        public decimal Amount { get; set; }
        public string Status { get; set; } = "Paid";
        public DateTime PaidAt { get; set; } = DateTime.UtcNow;
    }
}
