using System.Text;
using System.Text.Json;
using THEBOB.Models;
using System.Collections.Generic;

namespace THEBOB.Services
{
    public class GhnService : IGhnService
    {
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _config;
        private readonly string _token;
        private readonly string _shopId;

        public GhnService(HttpClient httpClient, IConfiguration config)
        {
            _httpClient = httpClient;
            _config = config;
            _token = config["GHN:Token"] ?? string.Empty;
            _shopId = config["GHN:ShopId"] ?? string.Empty;
        }

        private void SetHeaders(bool includeShopId = true)
        {
            _httpClient.DefaultRequestHeaders.Clear();
            if (!string.IsNullOrWhiteSpace(_token))
                _httpClient.DefaultRequestHeaders.Add("Token", _token);
            if (includeShopId && !string.IsNullOrWhiteSpace(_shopId))
                _httpClient.DefaultRequestHeaders.Add("ShopId", _shopId);
        }

        public async Task<List<GhnProvince>> GetProvincesAsync()
        {
            SetHeaders(false);
            var res = await _httpClient.GetAsync("shiip/public-api/master-data/province");
            var payload = await ParseResponse(res);
            return ParseProvinces(payload);
        }

        public async Task<List<GhnDistrict>> GetDistrictsAsync(int provinceId)
        {
            SetHeaders(false);
            var body = new { province_id = provinceId };
            var content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
            var res = await _httpClient.PostAsync("shiip/public-api/master-data/district", content);
            var payload = await ParseResponse(res);
            return ParseDistricts(payload);
        }

        public async Task<List<GhnWard>> GetWardsAsync(int districtId)
        {
            SetHeaders(false);
            var body = new { district_id = districtId };
            var content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
            var res = await _httpClient.PostAsync("shiip/public-api/master-data/ward", content);
            var payload = await ParseResponse(res);
            return ParseWards(payload);
        }

        public async Task<GhnFeeResponse> CalculateFeeAsync(GhnFeeRequest request)
        {
            SetHeaders();
            var fromDistrictId = string.IsNullOrWhiteSpace(request.FromDistrictId)
                ? _config["GHN:FromDistrictId"] ?? "1454"
                : request.FromDistrictId;
            var fromWardCode = string.IsNullOrWhiteSpace(request.FromWardCode)
                ? _config["GHN:FromWardCode"] ?? string.Empty
                : request.FromWardCode;

            var body = new Dictionary<string, object?>
            {
                ["service_type_id"] = request.ServiceTypeId,
                ["from_district_id"] = int.TryParse(fromDistrictId, out var parsedFromDistrictId)
                    ? parsedFromDistrictId
                    : 1454,
                ["to_district_id"] = request.ToDistrictId,
                ["to_ward_code"] = request.ToWardCode,
                ["weight"] = request.Weight,
                ["length"] = request.Length,
                ["width"] = request.Width,
                ["height"] = request.Height,
                ["insurance_value"] = request.InsuranceValue
            };

            if (!string.IsNullOrWhiteSpace(fromWardCode))
                body["from_ward_code"] = fromWardCode;

            var content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
            var res = await _httpClient.PostAsync("shiip/public-api/v2/shipping-order/fee", content);
            var payload = await ParseResponse(res);
            return ParseFee(payload);
        }

       public async Task<GhnCreateOrderResponse> CreateShippingOrderAsync(GhnCreateOrderRequest request)
{
    SetHeaders();
    var json = JsonSerializer.Serialize(request);
    Console.WriteLine($"[DEBUG GHN REQUEST BODY] {json}");
    var content = new StringContent(json, Encoding.UTF8, "application/json");
    var res = await _httpClient.PostAsync("shiip/public-api/v2/shipping-order/create", content);
    var payload = await ParseResponse(res);
    Console.WriteLine($"[DEBUG GHN RESPONSE BODY] {payload.GetRawText()}");   // ✅ thêm dòng này
    return ParseCreateOrder(payload);
}

        public async Task<GhnTrackingResponse> GetTrackingAsync(string ghnOrderCode)
        {
            SetHeaders(false);
            var body = new { order_code = ghnOrderCode };
            var content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
            var res = await _httpClient.PostAsync("shiip/public-api/v2/shipping-order/detail", content);
            var payload = await ParseResponse(res);
            return ParseTracking(payload);
        }

        public async Task CancelShippingOrderAsync(string ghnOrderCode)
        {
            SetHeaders(false);
            var body = new { order_code = ghnOrderCode };
            var content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
            await _httpClient.PostAsync("shiip/public-api/v2/shipping-order/cancel", content);
        }

    private async Task<JsonElement> ParseResponse(HttpResponseMessage res)
{
    var json = await res.Content.ReadAsStringAsync();
    
    if (!res.IsSuccessStatusCode)
    {
        throw new InvalidOperationException($"GHN HTTP error {(int)res.StatusCode}: {json}");
    }

    var root = JsonSerializer.Deserialize<JsonElement>(json);

    // GHN luôn trả HTTP 200, lỗi nghiệp vụ nằm trong field "code" của body
    if (root.ValueKind == JsonValueKind.Object && root.TryGetProperty("code", out var codeProp))
    {
        var ghnCode = codeProp.ValueKind == JsonValueKind.Number ? codeProp.GetInt32() : 0;
        if (ghnCode != 200)
        {
            var message = root.TryGetProperty("message", out var msgProp)
                ? msgProp.GetString()
                : "Unknown GHN error";

            var messageDetail = root.TryGetProperty("message_display", out var msgDisplayProp)
                ? msgDisplayProp.GetString()
                : null;

            throw new InvalidOperationException(
                $"GHN business error (code={ghnCode}): {message} {messageDetail}".Trim());
        }
    }

    return root;
}
        // ─── Địa chỉ: parse thủ công bằng GetInt/GetString ──────────────────
        // Không dùng JsonSerializer.Deserialize<List<T>> generic vì GHN trả về
        // field với casing không nhất quán (vd "DistrictID" thay vì "DistrictId"),
        // dẫn tới auto-mapping bị bỏ mặc định về 0/"". Parse thủ công với nhiều
        // biến thể tên field (snake_case lẫn PascalCase/ID) để chắc chắn khớp.

        private static List<GhnProvince> ParseProvinces(JsonElement payload)
        {
            var list = new List<GhnProvince>();
            var data = payload.ValueKind == JsonValueKind.Object && payload.TryGetProperty("data", out var property)
                ? property
                : payload;

            if (data.ValueKind != JsonValueKind.Array) return list;

            foreach (var item in data.EnumerateArray())
            {
                list.Add(new GhnProvince
                {
                    ProvinceId = GetInt(item, "province_id", "ProvinceId", "ProvinceID"),
                    ProvinceName = GetString(item, "province_name", "ProvinceName")
                });
            }

            return list;
        }

        private static List<GhnDistrict> ParseDistricts(JsonElement payload)
        {
            var list = new List<GhnDistrict>();
            var data = payload.ValueKind == JsonValueKind.Object && payload.TryGetProperty("data", out var property)
                ? property
                : payload;

            if (data.ValueKind != JsonValueKind.Array) return list;

            foreach (var item in data.EnumerateArray())
            {
                list.Add(new GhnDistrict
                {
                    DistrictId = GetInt(item, "district_id", "DistrictId", "DistrictID"),
                    DistrictName = GetString(item, "district_name", "DistrictName"),
                    ProvinceId = GetInt(item, "province_id", "ProvinceId", "ProvinceID")
                });
            }

            return list;
        }

        private static List<GhnWard> ParseWards(JsonElement payload)
        {
            var list = new List<GhnWard>();
            var data = payload.ValueKind == JsonValueKind.Object && payload.TryGetProperty("data", out var property)
                ? property
                : payload;

            if (data.ValueKind != JsonValueKind.Array) return list;

            foreach (var item in data.EnumerateArray())
            {
                list.Add(new GhnWard
                {
                    WardCode = GetString(item, "ward_code", "WardCode"),
                    WardName = GetString(item, "ward_name", "WardName"),
                    DistrictId = GetInt(item, "district_id", "DistrictId", "DistrictID")
                });
            }

            return list;
        }

        private static GhnFeeResponse ParseFee(JsonElement payload)
        {
            var data = payload.ValueKind == JsonValueKind.Object && payload.TryGetProperty("data", out var property)
                ? property
                : payload;

            return new GhnFeeResponse
            {
                Total = GetInt(data, "total", "Total"),
                ServiceFee = GetInt(data, "service_fee", "ServiceFee"),
                InsuranceFee = GetInt(data, "insurance_fee", "InsuranceFee"),
                PickStationFee = GetInt(data, "pick_station_fee", "PickStationFee"),
                CouponValue = GetInt(data, "coupon_value", "CouponValue"),
                R2sFee = GetInt(data, "r2s_fee", "R2sFee")
            };
        }

        private static GhnCreateOrderResponse ParseCreateOrder(JsonElement payload)
        {
            var data = payload.ValueKind == JsonValueKind.Object && payload.TryGetProperty("data", out var property)
                ? property
                : payload;

            return new GhnCreateOrderResponse
            {
                OrderCode = GetString(data, "order_code", "OrderCode"),
                SortCode = GetString(data, "sort_code", "SortCode"),
                TransType = GetString(data, "trans_type", "TransType"),
                WardEncode = GetString(data, "ward_encode", "WardEncode"),
                DistrictEncode = GetString(data, "district_encode", "DistrictEncode"),
                Fee = GetInt(data, "fee", "Fee"),
                TotalFee = GetString(data, "total_fee", "TotalFee"),
                ExpectedDeliveryTime = GetDateTime(data, "expected_delivery_time", "ExpectedDeliveryTime") ?? DateTime.MinValue
            };
        }

        private static GhnTrackingResponse ParseTracking(JsonElement payload)
        {
            var data = payload.ValueKind == JsonValueKind.Object && payload.TryGetProperty("data", out var property)
                ? property
                : payload;

            return new GhnTrackingResponse
            {
                OrderCode = GetString(data, "order_code", "OrderCode"),
                ClientOrderCode = GetString(data, "client_order_code", "ClientOrderCode"),
                ReturnCode = GetString(data, "return_code", "ReturnCode"),
                Status = GetString(data, "status", "Status"),
                StatusName = GetString(data, "status_name", "StatusName"),
                PickDate = GetDateTime(data, "pick_date", "PickDate"),
                DeliverDate = GetDateTime(data, "deliver_date", "DeliverDate")
            };
        }

        private static int GetInt(JsonElement element, params string[] propertyNames)
        {
            foreach (var propertyName in propertyNames)
            {
                if (element.ValueKind == JsonValueKind.Object && element.TryGetProperty(propertyName, out var property))
                {
                    if (property.ValueKind == JsonValueKind.Number && property.TryGetInt32(out var intValue))
                        return intValue;
                    if (property.ValueKind == JsonValueKind.String && int.TryParse(property.GetString(), out var parsed))
                        return parsed;
                }
            }

            return 0;
        }

        private static string GetString(JsonElement element, params string[] propertyNames)
        {
            foreach (var propertyName in propertyNames)
            {
                if (element.ValueKind == JsonValueKind.Object && element.TryGetProperty(propertyName, out var property))
                {
                    if (property.ValueKind == JsonValueKind.String)
                        return property.GetString() ?? string.Empty;
                    if (property.ValueKind == JsonValueKind.Number)
                        return property.GetRawText();
                }
            }

            return string.Empty;
        }

        private static DateTime? GetDateTime(JsonElement element, params string[] propertyNames)
        {
            foreach (var propertyName in propertyNames)
            {
                if (element.ValueKind == JsonValueKind.Object && element.TryGetProperty(propertyName, out var property))
                {
                    if (property.ValueKind == JsonValueKind.String && DateTime.TryParse(property.GetString(), out var dt))
                        return dt;
                }
            }

            return null;
        }
    }
}