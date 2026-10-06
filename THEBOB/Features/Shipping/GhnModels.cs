// Models/GhnModels.cs
using System.Text.Json.Serialization;
namespace THEBOB.Models;


// ─── Tính phí ship ────────────────────────────────────────────────────────────

public class GhnFeeRequest
{
    public int ServiceTypeId { get; set; } = 2; // 2 = E-commerce (chuẩn)
    public string FromDistrictId { get; set; } = string.Empty; // District ID kho của bạn
    public string FromWardCode { get; set; } = string.Empty;
    public int ToDistrictId { get; set; }
    public string ToWardCode { get; set; } = string.Empty;
    public int Weight { get; set; }          // gram
    public int Length { get; set; }          // cm
    public int Width { get; set; }           // cm
    public int Height { get; set; }          // cm
    public long InsuranceValue { get; set; } // VND — giá trị bảo hiểm
}

public class GhnFeeResponse
{
    public int Total { get; set; }
    public int ServiceFee { get; set; }
    public int InsuranceFee { get; set; }
    public int PickStationFee { get; set; }
    public int CouponValue { get; set; }
    public int R2sFee { get; set; }
}

// ─── Tạo đơn vận chuyển ──────────────────────────────────────────────────────



public class GhnCreateOrderRequest
{
    [JsonPropertyName("payment_type_id")]
    public int PaymentTypeId { get; set; } = 1;

    [JsonPropertyName("note")]
    public string Note { get; set; } = string.Empty;

    [JsonPropertyName("required_note")]
    public string RequiredNote { get; set; } = "KHONGCHOXEMHANG";

    [JsonPropertyName("to_name")]
    public string ToName { get; set; } = string.Empty;

    [JsonPropertyName("to_phone")]
    public string ToPhone { get; set; } = string.Empty;

    [JsonPropertyName("to_address")]
    public string ToAddress { get; set; } = string.Empty;

    [JsonPropertyName("to_ward_code")]
    public string ToWardCode { get; set; } = string.Empty;

    [JsonPropertyName("to_district_id")]
    public int ToDistrictId { get; set; }

    [JsonPropertyName("weight")]
    public int Weight { get; set; }

    [JsonPropertyName("length")]
    public int Length { get; set; }

    [JsonPropertyName("width")]
    public int Width { get; set; }

    [JsonPropertyName("height")]
    public int Height { get; set; }

    [JsonPropertyName("insurance_value")]
    public long InsuranceValue { get; set; }

    [JsonPropertyName("service_type_id")]
    public int ServiceTypeId { get; set; } = 2;

    [JsonPropertyName("cod_amount")]
    public int CodAmount { get; set; }

    [JsonPropertyName("client_order_code")]
    public string ClientOrderCode { get; set; } = string.Empty;

    [JsonPropertyName("content")]
    public string Content { get; set; } = string.Empty;

    [JsonPropertyName("items")]
    public List<GhnOrderItem> Items { get; set; } = new();
}

public class GhnOrderItem
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("code")]
    public string? Code { get; set; }

    [JsonPropertyName("quantity")]
    public int Quantity { get; set; }

    [JsonPropertyName("price")]
    public int Price { get; set; }

    [JsonPropertyName("length")]
    public int Length { get; set; }

    [JsonPropertyName("width")]
    public int Width { get; set; }

    [JsonPropertyName("height")]
    public int Height { get; set; }

    [JsonPropertyName("weight")]
    public int Weight { get; set; }
}
public class GhnCreateOrderResponse
{
    public string OrderCode { get; set; } = string.Empty;
    public string SortCode { get; set; } = string.Empty;
    public string TransType { get; set; } = string.Empty;
    public string WardEncode { get; set; } = string.Empty;
    public string DistrictEncode { get; set; } = string.Empty;
    public int Fee { get; set; }
    public string TotalFee { get; set; } = string.Empty;
    public DateTime ExpectedDeliveryTime { get; set; }
}

// ─── Tra cứu tracking ────────────────────────────────────────────────────────

public class GhnTrackingResponse
{
    public string OrderCode { get; set; } = string.Empty;
    public string ClientOrderCode { get; set; } = string.Empty;
    public string ReturnCode { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string StatusName { get; set; } = string.Empty;
    public DateTime? PickDate { get; set; }
    public DateTime? DeliverDate { get; set; }
    public List<GhnLog> Logs { get; set; } = new();
}

public class GhnLog
{
    public string Status { get; set; } = string.Empty;
    public DateTime UpdatedDate { get; set; }
    public string Description { get; set; } = string.Empty;
}

// ─── Webhook payload từ GHN ──────────────────────────────────────────────────

public class GhnWebhookPayload
{
    public string OrderCode { get; set; } = string.Empty;
    public string ClientOrderCode { get; set; } = string.Empty; // order ID của bạn
    public string Status { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public DateTime Time { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string CODTransferDate { get; set; } = string.Empty;
}

// ─── Địa chỉ GHN ─────────────────────────────────────────────────────────────

public class GhnProvince
{
    public int ProvinceId { get; set; }
    public string ProvinceName { get; set; } = string.Empty;
}

public class GhnDistrict
{
    public int DistrictId { get; set; }
    public string DistrictName { get; set; } = string.Empty;
    public int ProvinceId { get; set; }
}

public class GhnWard
{
    public string WardCode { get; set; } = string.Empty;
    public string WardName { get; set; } = string.Empty;
    public int DistrictId { get; set; }
}