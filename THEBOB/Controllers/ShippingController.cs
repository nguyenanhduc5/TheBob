// Controllers/ShippingController.cs
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using THEBOB.Data;
using THEBOB.Hubs;
using THEBOB.Models;
using THEBOB.Services;

namespace THEBOB.Controllers;

[ApiController]
[Route("api/shipping")]
public class ShippingController : ControllerBase
{
    private readonly IGhnService _ghn;
    private readonly ThebobDbContext _context;
    private readonly ILogger<ShippingController> _logger;
    private readonly IHubContext<OrderHub> _hubContext;

    public ShippingController(
        IGhnService ghn,
        ThebobDbContext context,
        ILogger<ShippingController> logger,
        IHubContext<OrderHub> hubContext)
    {
        _ghn = ghn;
        _context = context;
        _logger = logger;
        _hubContext = hubContext;
    }

    // ── Địa chỉ ───────────────────────────────────────────────────────────────

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
    // Route 1: /api/shipping/orders/{orderId}/create-shipment  (legacy)
    // Route 2: /api/admin/orders/{id}/create-shipment          (alias rõ nghĩa hơn)

    [Authorize(Roles = "Admin")]
    [HttpPost("orders/{orderId}/create-shipment")]
    [HttpPost("/api/admin/orders/{orderId}/create-shipment")]
    public async Task<IActionResult> CreateShipment(
        int orderId,
        [FromBody] GhnCreateOrderRequest? request)
    {
        try
        {
            var order = await _context.Orders
                .Include(o => o.User)
                .Include(o => o.OrderItems)
                .FirstOrDefaultAsync(o => o.Id == orderId);

            if (order == null)
                return NotFound(new { message = "Không tìm thấy đơn hàng." });

            // Chỉ tạo vận đơn khi đơn đang ở Processing
            if (order.Status != OrderStatus.Processing)
                return BadRequest(new
                {
                    message = $"Chỉ có thể tạo vận đơn khi đơn ở trạng thái 'Đang xử lý'. Trạng thái hiện tại: {order.Status}"
                });

            if (!string.IsNullOrWhiteSpace(order.GhnOrderCode))
                return BadRequest(new { message = $"Đơn đã có mã GHN: {order.GhnOrderCode}" });

            if (!order.GhnDistrictId.HasValue || string.IsNullOrWhiteSpace(order.GhnWardCode))
                return BadRequest(new { message = "Đơn thiếu mã địa chỉ GHN (district/ward)." });

            var ghnRequest = request ?? GhnOrderRequestBuilder.FromOrder(order, order.OrderItems);

            if (string.IsNullOrWhiteSpace(ghnRequest.ToName))
                ghnRequest.ToName = order.User?.FullName ?? order.User?.Email ?? "Khách hàng";

            // Some versions of GhnCreateOrderRequest may not expose ClientOrderCode / CodAmount
            // Use reflection to set them if present to avoid compile-time dependency issues.
            var reqType = ghnRequest.GetType();
            var propClientOrderCode = reqType.GetProperty("ClientOrderCode");
            if (propClientOrderCode != null)
            {
                var current = propClientOrderCode.GetValue(ghnRequest) as string;
                if (string.IsNullOrWhiteSpace(current))
                    propClientOrderCode.SetValue(ghnRequest, order.OrderNumber);
            }

            var propCodAmount = reqType.GetProperty("CodAmount");
            if (propCodAmount != null)
            {
                var currentVal = propCodAmount.GetValue(ghnRequest);
                long currentLong = 0;
                if (currentVal is int i) currentLong = i;
                else if (currentVal is long l) currentLong = l;

                if (currentLong == 0 && order.PaymentMethod.Equals("cod", StringComparison.OrdinalIgnoreCase))
                {
                    // set as int if property type is int, otherwise set as long
                    if (propCodAmount.PropertyType == typeof(int))
                        propCodAmount.SetValue(ghnRequest, (int)Math.Round(order.TotalAmount));
                    else if (propCodAmount.PropertyType == typeof(long))
                        propCodAmount.SetValue(ghnRequest, (long)Math.Round(order.TotalAmount));
                }
            }

            var result = await _ghn.CreateShippingOrderAsync(ghnRequest);

            // Cập nhật đơn hàng: GHN code + Status → Shipped
            order.GhnOrderCode = result.OrderCode;
            order.ShippingStatus = "ready_to_pick";
            order.Status = OrderStatus.Shipped;
            order.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            _logger.LogInformation(
                "Đã tạo đơn GHN {GhnCode} cho đơn hàng #{OrderId} → Shipped",
                result.OrderCode, orderId);

            // Notify khách hàng qua SignalR
            try
            {
                await _hubContext.Clients.User(order.UserId.ToString())
                    .SendAsync("ReceiveStatusUpdate", order.Id, OrderStatus.Shipped.ToString());
            }
            catch (Exception ex)
            {
                _logger.LogWarning("SignalR notify failed for user {UserId}: {Message}", order.UserId, ex.Message);
            }

            return Ok(new
            {
                ghnOrderCode = result.OrderCode,
                orderStatus = OrderStatus.Shipped.ToString(),
                shippingStatus = "ready_to_pick",
                message = $"Đã tạo vận đơn GHN thành công. Mã: {result.OrderCode}"
            });
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
            var order = await _context.Orders.FindAsync(orderId);
            if (order == null)
                return NotFound(new { message = "Không tìm thấy đơn hàng." });

            await _ghn.CancelShippingOrderAsync(ghnOrderCode);

            // Rollback về Processing để admin có thể tạo lại vận đơn mới
            order.GhnOrderCode = null;
            order.ShippingStatus = "cancel";
            order.Status = OrderStatus.Processing;
            order.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            // Notify khách hàng
            try
            {
                await _hubContext.Clients.User(order.UserId.ToString())
                    .SendAsync("ReceiveStatusUpdate", order.Id, OrderStatus.Processing.ToString());
            }
            catch { /* ignore SignalR errors */ }

            return Ok(new { message = $"Đã hủy đơn vận chuyển {ghnOrderCode}. Đơn hàng trở về trạng thái Đang xử lý." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // ── Webhook từ GHN ────────────────────────────────────────────────────────

    [HttpPost("webhook/ghn")]
    public async Task<IActionResult> GhnWebhook(
        [FromBody] GhnWebhookPayload payload,
        [FromServices] IHubContext<OrderHub> hubContext)
    {
        _logger.LogInformation(
            "GHN Webhook: order {GhnCode} (client: {ClientCode}) → {Status}",
            payload.OrderCode, payload.ClientOrderCode, payload.Status);

        if (!string.IsNullOrWhiteSpace(payload.ClientOrderCode))
        {
            var order = await _context.Orders
                .FirstOrDefaultAsync(o => o.OrderNumber == payload.ClientOrderCode);

            if (order != null)
            {
                order.ShippingStatus = payload.Status;

                // Tự động cập nhật OrderStatus khi GHN webhook delivered
                if (payload.Status == "delivered" && order.Status == OrderStatus.Shipped)
                {
                    order.Status = OrderStatus.Delivered;
                    if (order.PaymentMethod.Equals("cod", StringComparison.OrdinalIgnoreCase))
                        order.PaymentStatus = "Completed";
                }

                order.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                // Notify khách hàng
                try
                {
                    await hubContext.Clients.User(order.UserId.ToString())
                        .SendAsync("ReceiveStatusUpdate", order.Id, order.Status.ToString());
                }
                catch { /* ignore */ }
            }
        }

        await hubContext.Clients.All.SendAsync(
            "ReceiveShippingUpdate",
            payload.ClientOrderCode,
            payload.Status,
            payload.Description);

        return Ok();
    }
}
