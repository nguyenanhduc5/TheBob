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
    public string PaymentTypeId { get; set; } = "1"; // 1=Shop trả ship, 2=Người nhận trả ship
    public string Note { get; set; } = string.Empty;
    public string RequiredNote { get; set; } = "KHONGCHOXEMHANG"; // Không cho xem hàng
    public string ToName { get; set; } = string.Empty;
    public string ToPhone { get; set; } = string.Empty;
    public string ToAddress { get; set; } = string.Empty;
    public string ToWardCode { get; set; } = string.Empty;
    public int ToDistrictId { get; set; }
    public int Weight { get; set; }
    public int Length { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
    public long InsuranceValue { get; set; }
    public int ServiceTypeId { get; set; } = 2;
    /// <summary>Tiền thu hộ COD (VND). Bắt buộc khi đơn COD.</summary>
    public int CodAmount { get; set; }
    /// <summary>Mã đơn nội bộ (OrderNumber) để đối soát trên GHN.</summary>
    public string ClientOrderCode { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public List<GhnOrderItem> Items { get; set; } = new();
}

public class GhnOrderItem
{
    public string Name { get; set; } = string.Empty;
    public int Code { get; set; }
    public int Quantity { get; set; }
    public int Price { get; set; }
    public int Length { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
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
    [JsonPropertyName("OrderCode")]
    public string OrderCode { get; set; } = string.Empty;

    [JsonPropertyName("ClientOrderCode")]
    public string ClientOrderCode { get; set; } = string.Empty; // order ID của bạn

    [JsonPropertyName("Status")]
    public string Status { get; set; } = string.Empty;

    [JsonPropertyName("Description")]
    public string Description { get; set; } = string.Empty;

    [JsonPropertyName("Time")]
    public DateTime Time { get; set; }

    [JsonPropertyName("Reason")]
    public string Reason { get; set; } = string.Empty;

    [JsonPropertyName("CODTransferDate")]
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
