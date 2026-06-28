// Controllers/ShippingController.cs
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using THEBOB.Hubs;
using THEBOB.Models;
using THEBOB.Services;

namespace THEBOB.Controllers;

[ApiController]
[Route("api/shipping")]
public class ShippingController : ControllerBase
{
    private readonly IGhnService _ghn;
    private readonly ILogger<ShippingController> _logger;
    // Inject thêm IOrderRepository nếu bạn cần lưu ghnOrderCode vào DB
    // private readonly IOrderRepository _orders;

    public ShippingController(
        IGhnService ghn,
        ILogger<ShippingController> logger)
    {
        _ghn    = ghn;
        _logger = logger;
    }

    // ── Địa chỉ ───────────────────────────────────────────────────────────────

    /// <summary>Lấy danh sách tỉnh/thành — dùng cho dropdown chọn địa chỉ.</summary>
    [HttpGet("provinces")]
    public async Task<IActionResult> GetProvinces()
    {
        var data = await _ghn.GetProvincesAsync();
        return Ok(data);
    }

    [HttpGet("districts/{provinceId:int}")]
    public async Task<IActionResult> GetDistricts(int provinceId)
    {
        var data = await _ghn.GetDistrictsAsync(provinceId);
        return Ok(data);
    }

    [HttpGet("wards/{districtId:int}")]
    public async Task<IActionResult> GetWards(int districtId)
    {
        var data = await _ghn.GetWardsAsync(districtId);
        return Ok(data);
    }

    // ── Tính phí ship ─────────────────────────────────────────────────────────

    /// <summary>
    /// Tính phí ship trước khi đặt hàng (gọi từ checkout).
    /// Frontend gửi địa chỉ khách + thông số kiện hàng.
    /// </summary>
    [HttpPost("fee")]
    public async Task<IActionResult> CalculateFee([FromBody] GhnFeeRequest request)
    {
        try
        {
            var fee = await _ghn.CalculateFeeAsync(request);
            return Ok(fee);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning("GHN fee error: {Message}", ex.Message);
            return BadRequest(new { message = ex.Message });
        }
    }

    // ── Tạo đơn vận chuyển ────────────────────────────────────────────────────

    /// <summary>
    /// Admin bấm "Tạo đơn vận chuyển" trong AdminOrders.
    /// Trả về GHN order code để lưu vào DB và hiển thị tracking.
    /// </summary>
    [Authorize(Roles = "Admin")]
    [HttpPost("orders/{orderId}/create-shipment")]
    public async Task<IActionResult> CreateShipment(
        int orderId,
        [FromBody] GhnCreateOrderRequest request)
    {
        try
        {
            var result = await _ghn.CreateShippingOrderAsync(request);

            // TODO: lưu result.OrderCode vào Order trong DB
            // await _orders.UpdateGhnCodeAsync(orderId, result.OrderCode);

            _logger.LogInformation(
                "Đã tạo đơn GHN {GhnCode} cho đơn hàng #{OrderId}",
                result.OrderCode, orderId);

            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning("GHN create error (order #{OrderId}): {Message}", orderId, ex.Message);
            return BadRequest(new { message = ex.Message });
        }
    }

    // ── Tra cứu tracking ──────────────────────────────────────────────────────

    [HttpGet("tracking/{ghnOrderCode}")]
    public async Task<IActionResult> GetTracking(string ghnOrderCode)
    {
        try
        {
            var tracking = await _ghn.GetTrackingAsync(ghnOrderCode);
            return Ok(tracking);
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    // ── Hủy đơn vận chuyển ────────────────────────────────────────────────────

    [Authorize(Roles = "Admin")]
    [HttpDelete("orders/{orderId}/shipment/{ghnOrderCode}")]
    public async Task<IActionResult> CancelShipment(int orderId, string ghnOrderCode)
    {
        try
        {
            await _ghn.CancelShippingOrderAsync(ghnOrderCode);

            // TODO: cập nhật trạng thái trong DB
            // await _orders.ClearGhnCodeAsync(orderId);

            return Ok(new { message = $"Đã hủy đơn vận chuyển {ghnOrderCode}" });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // ── Webhook từ GHN ────────────────────────────────────────────────────────

    /// <summary>
    /// GHN gọi endpoint này khi trạng thái đơn thay đổi (giao thành công, hoàn, v.v.)
    /// URL này bạn đăng ký trong dashboard GHN → Cài đặt → Webhook.
    /// KHÔNG đặt [Authorize] — GHN gọi không có Bearer token.
    /// Bảo mật bằng secret token trong header X-GHN-Signature hoặc IP whitelist.
    /// </summary>
    [HttpPost("webhook/ghn")]
    public async Task<IActionResult> GhnWebhook(
        [FromBody] GhnWebhookPayload payload,
        [FromServices] IHubContext<OrderHub> hubContext) // SignalR push real-time
    {
        // Bảo vệ webhook: xác minh token GHN gửi kèm (nếu bạn cấu hình)
        // var secret = Request.Headers["X-GHN-Token"].ToString();
        // if (secret != _config["GHN:WebhookSecret"]) return Unauthorized();

        _logger.LogInformation(
            "GHN Webhook: order {GhnCode} (client: {ClientCode}) → {Status}",
            payload.OrderCode, payload.ClientOrderCode, payload.Status);

        // TODO: cập nhật trạng thái vào DB theo payload.ClientOrderCode (order ID của bạn)
        // await _orders.UpdateShippingStatusAsync(payload.ClientOrderCode, payload.Status);

        // Push real-time qua SignalR xuống AdminOrders
        await hubContext.Clients.All.SendAsync(
            "ReceiveShippingUpdate",
            payload.ClientOrderCode,
            payload.Status,
            payload.Description);

        return Ok(); // GHN cần nhận 200 OK, nếu không nó retry
    }
}