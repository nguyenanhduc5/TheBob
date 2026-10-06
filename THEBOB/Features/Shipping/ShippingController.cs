using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using THEBOB.Models;
using THEBOB.Services;

namespace THEBOB.Controllers;

[ApiController]
[Route("api/shipping")]
public class ShippingController : ControllerBase
{
    private readonly IShippingService _shippingService;

    public ShippingController(IShippingService shippingService)
    {
        _shippingService = shippingService;
    }

    // ── Địa chỉ ───────────────────────────────────────────────────────────────

    [HttpGet("provinces")]
    public async Task<IActionResult> GetProvinces()
    {
        var data = await _shippingService.GetProvincesAsync();
        return Ok(data);
    }

    [HttpGet("districts/{provinceId:int}")]
    public async Task<IActionResult> GetDistricts(int provinceId)
    {
        var data = await _shippingService.GetDistrictsAsync(provinceId);
        return Ok(data);
    }

    [HttpGet("wards/{districtId:int}")]
    public async Task<IActionResult> GetWards(int districtId)
    {
        var data = await _shippingService.GetWardsAsync(districtId);
        return Ok(data);
    }

    // ── Tính phí ship ─────────────────────────────────────────────────────────

    [HttpPost("fee")]
    public async Task<IActionResult> CalculateFee([FromBody] GhnFeeRequest request)
    {
        var fee = await _shippingService.CalculateFeeAsync(request);
        return Ok(fee);
    }

    // ── Tạo đơn vận chuyển ────────────────────────────────────────────────────
    [Authorize(Roles = "Admin")]
    [HttpPost("orders/{orderId}/create-shipment")]
    [HttpPost("/api/admin/orders/{orderId}/create-shipment")]
    public async Task<IActionResult> CreateShipment(
        int orderId,
        [FromBody] GhnCreateOrderRequest? request)
    {
        var result = await _shippingService.CreateShipmentAsync(orderId, request);
        if (!result.Success)
            return StatusCode(result.StatusCode, new { message = result.Message });

        return Ok(result.Data);
    }

    // ── Nhập mã GHN thủ công ──────────────────────────────────────────────────
    [Authorize(Roles = "Admin")]
    [HttpPatch("orders/{orderId}/ghn-code")]
    [HttpPatch("/api/admin/orders/{orderId}/ghn-code")]
    public async Task<IActionResult> SetGhnCodeManually(
        int orderId,
        [FromBody] SetGhnCodeRequest request)
    {
        var result = await _shippingService.SetGhnCodeManuallyAsync(orderId, request.GhnOrderCode);
        if (!result.Success)
            return StatusCode(result.StatusCode, new { message = result.Message });

        return Ok(result.Data);
    }

    // ── Tra cứu tracking ──────────────────────────────────────────────────────
    [HttpGet("tracking/{ghnOrderCode}")]
    public async Task<IActionResult> GetTracking(string ghnOrderCode)
    {
        var tracking = await _shippingService.GetTrackingAsync(ghnOrderCode);
        return Ok(tracking);
    }

    // ── Hủy đơn vận chuyển ────────────────────────────────────────────────────
    [Authorize(Roles = "Admin")]
    [HttpDelete("orders/{orderId}/shipment/{ghnOrderCode}")]
    public async Task<IActionResult> CancelShipment(int orderId, string ghnOrderCode)
    {
        var result = await _shippingService.CancelShipmentAsync(orderId, ghnOrderCode);
        if (!result.Success)
            return StatusCode(result.StatusCode, new { message = result.Message });

        return Ok(new { message = result.Message });
    }

    // ── Webhook từ GHN ────────────────────────────────────────────────────────
    [HttpPost("webhook/ghn")]
    public async Task<IActionResult> GhnWebhook([FromBody] GhnWebhookPayload payload)
    {
        await _shippingService.HandleGhnWebhookAsync(payload);
        return Ok();
    }
}

public class SetGhnCodeRequest
{
    public string GhnOrderCode { get; set; } = string.Empty;
}
