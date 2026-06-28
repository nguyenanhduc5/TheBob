using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using THEBOB.Models;

namespace THEBOB.Services;

public class GhnService : IGhnService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<GhnService> _logger;
    private readonly string _token;
    private readonly string _shopId;
    private readonly string _baseUrl;
    private readonly bool _useMock;

    public GhnService(
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<GhnService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;

        _token = configuration["GHN:Token"] ?? configuration["Ghn:Token"] ?? string.Empty;
        _shopId = configuration["GHN:ShopId"] ?? configuration["Ghn:ShopId"] ?? string.Empty;
        _baseUrl = (configuration["GHN:BaseUrl"] ?? configuration["Ghn:BaseUrl"] ?? "https://dev-online-gateway.ghn.vn/shiip/public-api/").TrimEnd('/') + "/";

        _useMock = string.IsNullOrWhiteSpace(_token) || _token.StartsWith("YOUR_");

        if (_useMock)
        {
            _logger.LogWarning("GHN API Token is not configured. GhnService will run in MOCK mode.");
        }
    }

    private HttpClient GetClient()
    {
        _httpClient.BaseAddress = new Uri(_baseUrl);
        _httpClient.DefaultRequestHeaders.Clear();
        _httpClient.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        _httpClient.DefaultRequestHeaders.Add("Token", _token);
        
        if (!string.IsNullOrWhiteSpace(_shopId))
        {
            _httpClient.DefaultRequestHeaders.Add("ShopId", _shopId);
        }

        return _httpClient;
    }

    public async Task<List<GhnProvince>> GetProvincesAsync()
    {
        if (_useMock)
        {
            return new List<GhnProvince>
            {
                new() { ProvinceId = 201, ProvinceName = "Thành phố Hà Nội" },
                new() { ProvinceId = 202, ProvinceName = "Thành phố Hồ Chí Minh" },
                new() { ProvinceId = 203, ProvinceName = "Thành phố Đà Nẵng" }
            };
        }

        try
        {
            var client = GetClient();
            var response = await client.GetAsync("master-data/province");
            response.EnsureSuccessStatusCode();
            var content = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(content);
            var root = doc.RootElement;
            var code = root.GetProperty("code").GetInt32();
            if (code != 200)
            {
                throw new InvalidOperationException(root.GetProperty("message").GetString());
            }

            var list = new List<GhnProvince>();
            foreach (var item in root.GetProperty("data").EnumerateArray())
            {
                list.Add(new GhnProvince
                {
                    ProvinceId = item.GetProperty("ProvinceID").GetInt32(),
                    ProvinceName = item.GetProperty("ProvinceName").GetString() ?? string.Empty
                });
            }
            return list;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting GHN provinces");
            throw new InvalidOperationException("Không thể lấy danh sách Tỉnh/Thành từ GHN: " + ex.Message);
        }
    }

    public async Task<List<GhnDistrict>> GetDistrictsAsync(int provinceId)
    {
        if (_useMock)
        {
            var districts = new List<GhnDistrict>();
            if (provinceId == 201)
            {
                districts.Add(new() { DistrictId = 1442, DistrictName = "Quận Ba Đình", ProvinceId = 201 });
                districts.Add(new() { DistrictId = 1443, DistrictName = "Quận Hoàn Kiếm", ProvinceId = 201 });
            }
            else if (provinceId == 202)
            {
                districts.Add(new() { DistrictId = 1450, DistrictName = "Quận 1", ProvinceId = 202 });
                districts.Add(new() { DistrictId = 1451, DistrictName = "Quận 3", ProvinceId = 202 });
            }
            else
            {
                districts.Add(new() { DistrictId = 1460, DistrictName = "Quận Hải Châu", ProvinceId = provinceId });
            }
            return districts;
        }

        try
        {
            var client = GetClient();
            var body = JsonSerializer.Serialize(new { province_id = provinceId });
            var response = await client.PostAsync("master-data/district", new StringContent(body, Encoding.UTF8, "application/json"));
            response.EnsureSuccessStatusCode();
            var content = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(content);
            var root = doc.RootElement;
            var code = root.GetProperty("code").GetInt32();
            if (code != 200)
            {
                throw new InvalidOperationException(root.GetProperty("message").GetString());
            }

            var list = new List<GhnDistrict>();
            foreach (var item in root.GetProperty("data").EnumerateArray())
            {
                list.Add(new GhnDistrict
                {
                    DistrictId = item.GetProperty("DistrictID").GetInt32(),
                    DistrictName = item.GetProperty("DistrictName").GetString() ?? string.Empty,
                    ProvinceId = item.GetProperty("ProvinceID").GetInt32()
                });
            }
            return list;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting GHN districts for province {ProvinceId}", provinceId);
            throw new InvalidOperationException("Không thể lấy danh sách Quận/Huyện từ GHN: " + ex.Message);
        }
    }

    public async Task<List<GhnWard>> GetWardsAsync(int districtId)
    {
        if (_useMock)
        {
            var wards = new List<GhnWard>();
            if (districtId == 1442)
            {
                wards.Add(new() { WardCode = "20314", WardName = "Phường Phúc Xá", DistrictId = 1442 });
                wards.Add(new() { WardCode = "20315", WardName = "Phường Trúc Bạch", DistrictId = 1442 });
            }
            else if (districtId == 1450)
            {
                wards.Add(new() { WardCode = "30101", WardName = "Phường Bến Nghé", DistrictId = 1450 });
                wards.Add(new() { WardCode = "30102", WardName = "Phường Bến Thành", DistrictId = 1450 });
            }
            else
            {
                wards.Add(new() { WardCode = "90901", WardName = "Phường Thạch Thang", DistrictId = districtId });
            }
            return wards;
        }

        try
        {
            var client = GetClient();
            var body = JsonSerializer.Serialize(new { district_id = districtId });
            var response = await client.PostAsync("master-data/ward", new StringContent(body, Encoding.UTF8, "application/json"));
            response.EnsureSuccessStatusCode();
            var content = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(content);
            var root = doc.RootElement;
            var code = root.GetProperty("code").GetInt32();
            if (code != 200)
            {
                throw new InvalidOperationException(root.GetProperty("message").GetString());
            }

            var list = new List<GhnWard>();
            foreach (var item in root.GetProperty("data").EnumerateArray())
            {
                list.Add(new GhnWard
                {
                    WardCode = item.GetProperty("WardCode").GetString() ?? string.Empty,
                    WardName = item.GetProperty("WardName").GetString() ?? string.Empty,
                    DistrictId = item.GetProperty("DistrictID").GetInt32()
                });
            }
            return list;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting GHN wards for district {DistrictId}", districtId);
            throw new InvalidOperationException("Không thể lấy danh sách Phường/Xã từ GHN: " + ex.Message);
        }
    }

    public async Task<GhnFeeResponse> CalculateFeeAsync(GhnFeeRequest request)
    {
        if (_useMock)
        {
            return new GhnFeeResponse
            {
                Total = 30000,
                ServiceFee = 30000,
                InsuranceFee = 0,
                PickStationFee = 0,
                CouponValue = 0,
                R2sFee = 0
            };
        }

        try
        {
            var client = GetClient();
            var payload = new
            {
                service_type_id = request.ServiceTypeId == 0 ? 2 : request.ServiceTypeId,
                from_district_id = string.IsNullOrWhiteSpace(request.FromDistrictId) ? null : (int?)int.Parse(request.FromDistrictId),
                to_district_id = request.ToDistrictId,
                to_ward_code = request.ToWardCode,
                weight = request.Weight,
                length = request.Length,
                width = request.Width,
                height = request.Height,
                insurance_value = request.InsuranceValue
            };

            var body = JsonSerializer.Serialize(payload);
            var response = await client.PostAsync("v2/shipping-order/fee", new StringContent(body, Encoding.UTF8, "application/json"));
            var content = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("GHN CalculateFee error response: {Body}", content);
                throw new InvalidOperationException("GHN API returned error status: " + response.StatusCode);
            }

            using var doc = JsonDocument.Parse(content);
            var root = doc.RootElement;
            var code = root.GetProperty("code").GetInt32();
            if (code != 200)
            {
                throw new InvalidOperationException(root.GetProperty("message").GetString());
            }

            var data = root.GetProperty("data");
            return new GhnFeeResponse
            {
                Total = data.GetProperty("total").GetInt32(),
                ServiceFee = data.GetProperty("service_fee").GetInt32(),
                InsuranceFee = data.GetProperty("insurance_fee").GetInt32(),
                PickStationFee = data.GetProperty("pick_station_fee").GetInt32(),
                CouponValue = data.GetProperty("coupon_value").GetInt32(),
                R2sFee = data.GetProperty("r2s_fee").GetInt32()
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error calculating GHN fee");
            throw new InvalidOperationException("Không thể tính phí vận chuyển từ GHN: " + ex.Message);
        }
    }

    public async Task<GhnCreateOrderResponse> CreateShippingOrderAsync(GhnCreateOrderRequest request)
    {
        if (_useMock)
        {
            return new GhnCreateOrderResponse
            {
                OrderCode = "GHN" + new Random().Next(100000, 999999),
                SortCode = "A1-B2",
                TransType = "E-Commerce",
                WardEncode = "W-ENC",
                DistrictEncode = "D-ENC",
                Fee = 30000,
                TotalFee = "30000",
                ExpectedDeliveryTime = DateTime.UtcNow.AddDays(3)
            };
        }

        try
        {
            var client = GetClient();
            var payload = new
            {
                payment_type_id = int.TryParse(request.PaymentTypeId, out var pId) ? pId : 1,
                note = request.Note,
                required_note = string.IsNullOrWhiteSpace(request.RequiredNote) ? "KHONGCHOXEMHANG" : request.RequiredNote,
                to_name = request.ToName,
                to_phone = request.ToPhone,
                to_address = request.ToAddress,
                to_ward_code = request.ToWardCode,
                to_district_id = request.ToDistrictId,
                weight = request.Weight,
                length = request.Length,
                width = request.Width,
                height = request.Height,
                insurance_value = (int)request.InsuranceValue,
                service_type_id = request.ServiceTypeId == 0 ? 2 : request.ServiceTypeId,
                items = request.Items.ConvertAll(i => new
                {
                    name = i.Name,
                    code = i.Code.ToString(),
                    quantity = i.Quantity,
                    price = i.Price,
                    length = i.Length,
                    width = i.Width,
                    height = i.Height,
                    weight = i.Weight
                })
            };

            var body = JsonSerializer.Serialize(payload);
            var response = await client.PostAsync("v2/shipping-order/create", new StringContent(body, Encoding.UTF8, "application/json"));
            var content = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("GHN CreateOrder error response: {Body}", content);
                throw new InvalidOperationException("GHN API returned error status: " + response.StatusCode);
            }

            using var doc = JsonDocument.Parse(content);
            var root = doc.RootElement;
            var code = root.GetProperty("code").GetInt32();
            if (code != 200)
            {
                throw new InvalidOperationException(root.GetProperty("message").GetString());
            }

            var data = root.GetProperty("data");
            return new GhnCreateOrderResponse
            {
                OrderCode = data.GetProperty("order_code").GetString() ?? string.Empty,
                SortCode = data.TryGetProperty("sort_code", out var sProp) ? sProp.GetString() ?? string.Empty : string.Empty,
                TransType = data.TryGetProperty("trans_type", out var tProp) ? tProp.GetString() ?? string.Empty : string.Empty,
                ExpectedDeliveryTime = data.TryGetProperty("expected_delivery_time", out var timeProp) 
                    ? timeProp.GetDateTime() 
                    : DateTime.UtcNow.AddDays(3)
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating GHN shipping order");
            throw new InvalidOperationException("Không thể tạo đơn hàng vận chuyển trên GHN: " + ex.Message);
        }
    }

    public async Task<GhnTrackingResponse> GetTrackingAsync(string ghnOrderCode)
    {
        if (_useMock)
        {
            return new GhnTrackingResponse
            {
                OrderCode = ghnOrderCode,
                ClientOrderCode = "MOCK_ORDER",
                ReturnCode = "",
                Status = "ready_to_pick",
                StatusName = "Chờ lấy hàng",
                PickDate = DateTime.UtcNow,
                DeliverDate = null,
                Logs = new List<GhnLog>
                {
                    new() { Status = "ready_to_pick", UpdatedDate = DateTime.UtcNow, Description = "Đơn hàng đã được tạo thành công trên hệ thống và đang chờ bàn giao." }
                }
            };
        }

        try
        {
            var client = GetClient();
            var body = JsonSerializer.Serialize(new { order_code = ghnOrderCode });
            var response = await client.PostAsync("v2/shipping-order/detail", new StringContent(body, Encoding.UTF8, "application/json"));
            var content = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("GHN GetTracking error response: {Body}", content);
                throw new InvalidOperationException("GHN API returned error status: " + response.StatusCode);
            }

            using var doc = JsonDocument.Parse(content);
            var root = doc.RootElement;
            var code = root.GetProperty("code").GetInt32();
            if (code != 200)
            {
                throw new InvalidOperationException(root.GetProperty("message").GetString());
            }

            var data = root.GetProperty("data");
            var tracking = new GhnTrackingResponse
            {
                OrderCode = data.GetProperty("order_code").GetString() ?? string.Empty,
                ClientOrderCode = data.TryGetProperty("client_order_code", out var cProp) ? cProp.GetString() ?? string.Empty : string.Empty,
                Status = data.GetProperty("status").GetString() ?? string.Empty,
                StatusName = MapStatusToName(data.GetProperty("status").GetString())
            };

            if (data.TryGetProperty("pick_date", out var pProp) && pProp.ValueKind != JsonValueKind.Null)
            {
                tracking.PickDate = pProp.GetDateTime();
            }
            if (data.TryGetProperty("deliver_date", out var dProp) && dProp.ValueKind != JsonValueKind.Null)
            {
                tracking.DeliverDate = dProp.GetDateTime();
            }

            if (data.TryGetProperty("log", out var logProp) && logProp.ValueKind == JsonValueKind.Array)
            {
                foreach (var logItem in logProp.EnumerateArray())
                {
                    tracking.Logs.Add(new GhnLog
                    {
                        Status = logItem.GetProperty("status").GetString() ?? string.Empty,
                        UpdatedDate = logItem.GetProperty("updated_date").GetDateTime(),
                        Description = MapStatusToName(logItem.GetProperty("status").GetString())
                    });
                }
            }

            return tracking;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting GHN tracking");
            throw new InvalidOperationException("Không thể lấy thông tin tracking từ GHN: " + ex.Message);
        }
    }

    public async Task CancelShippingOrderAsync(string ghnOrderCode)
    {
        if (_useMock)
        {
            return;
        }

        try
        {
            var client = GetClient();
            var payload = new { order_codes = new List<string> { ghnOrderCode } };
            var body = JsonSerializer.Serialize(payload);
            var response = await client.PostAsync("v2/shipping-order/cancel", new StringContent(body, Encoding.UTF8, "application/json"));
            var content = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("GHN CancelOrder error response: {Body}", content);
                throw new InvalidOperationException("GHN API returned error status: " + response.StatusCode);
            }

            using var doc = JsonDocument.Parse(content);
            var root = doc.RootElement;
            var code = root.GetProperty("code").GetInt32();
            if (code != 200)
            {
                throw new InvalidOperationException(root.GetProperty("message").GetString());
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error cancelling GHN order {GhnOrderCode}", ghnOrderCode);
            throw new InvalidOperationException("Không thể hủy đơn vận chuyển trên GHN: " + ex.Message);
        }
    }

    private string MapStatusToName(string? status)
    {
        if (string.IsNullOrWhiteSpace(status)) return "Không xác định";
        return status.ToLower() switch
        {
            "ready_to_pick" => "Chờ lấy hàng",
            "picking" => "Đang lấy hàng",
            "picked" => "Đã lấy hàng",
            "storing" => "Trong kho",
            "delivering" => "Đang giao hàng",
            "delivered" => "Giao hàng thành công",
            "delivery_fail" => "Giao hàng thất bại",
            "waiting_to_return" => "Chờ chuyển hoàn",
            "returning" => "Đang chuyển hoàn",
            "returned" => "Đã chuyển hoàn",
            "cancel" => "Đã hủy đơn",
            _ => status
        };
    }
}
