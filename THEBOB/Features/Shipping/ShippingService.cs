using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using THEBOB.Data;
using THEBOB.Hubs;
using THEBOB.Models;

namespace THEBOB.Services
{
    public class ShippingService : IShippingService
    {
        private readonly IGhnService _ghn;
        private readonly ThebobDbContext _context;
        private readonly ILogger<ShippingService> _logger;
        private readonly IHubContext<OrderHub> _hubContext;

        public ShippingService(
            IGhnService ghn,
            ThebobDbContext context,
            ILogger<ShippingService> logger,
            IHubContext<OrderHub> hubContext)
        {
            _ghn = ghn;
            _context = context;
            _logger = logger;
            _hubContext = hubContext;
        }

        public async Task<object> GetProvincesAsync()
        {
            return await _ghn.GetProvincesAsync();
        }

        public async Task<object> GetDistrictsAsync(int provinceId)
        {
            return await _ghn.GetDistrictsAsync(provinceId);
        }

        public async Task<object> GetWardsAsync(int districtId)
        {
            return await _ghn.GetWardsAsync(districtId);
        }

        public async Task<GhnFeeResponse> CalculateFeeAsync(GhnFeeRequest request)
        {
            return await _ghn.CalculateFeeAsync(request);
        }

        public async Task<GhnTrackingResponse> GetTrackingAsync(string ghnOrderCode)
        {
            return await _ghn.GetTrackingAsync(ghnOrderCode);
        }

        public async Task<(bool Success, string Message, int StatusCode, object? Data)> CreateShipmentAsync(int orderId, GhnCreateOrderRequest? request)
        {
            try
            {
                var order = await _context.Orders
                    .Include(o => o.User)
                    .Include(o => o.OrderItems)
                    .FirstOrDefaultAsync(o => o.Id == orderId);

                if (order == null)
                    return (false, "Không tìm thấy đơn hàng.", 404, null);

                if (order.Status != OrderStatus.Processing)
                    return (false, $"Chỉ có thể tạo vận đơn khi đơn ở trạng thái ''Đang xử lý''. Trạng thái hiện tại: {order.Status}", 400, null);

                if (!string.IsNullOrWhiteSpace(order.GhnOrderCode))
                    return (false, $"Đơn đã có mã GHN: {order.GhnOrderCode}", 400, null);

                if (!order.GhnDistrictId.HasValue || string.IsNullOrWhiteSpace(order.GhnWardCode))
                    return (false, "Đơn thiếu mã địa chỉ GHN (district/ward).", 400, null);

                var ghnRequest = request ?? GhnOrderRequestBuilder.FromOrder(order, order.OrderItems);

                if (string.IsNullOrWhiteSpace(ghnRequest.ToName))
                    ghnRequest.ToName = order.User?.FullName ?? order.User?.Email ?? "Khách hàng";

                if (string.IsNullOrWhiteSpace(ghnRequest.ClientOrderCode))
                    ghnRequest.ClientOrderCode = order.OrderNumber;

                var result = await _ghn.CreateShippingOrderAsync(ghnRequest);

                order.GhnOrderCode = result.OrderCode;
                order.ShippingStatus = "ready_to_pick";
                order.Status = OrderStatus.Shipped;
                order.UpdatedAt = DateTime.UtcNow;

                _context.Notifications.Add(new Notification
                {
                    UserId = order.UserId,
                    Message = $"Đơn hàng #{order.Id} của bạn đã chuyển sang trạng thái: [Đang giao hàng] (Mã vận đơn: {result.OrderCode})",
                    Type = "Info",
                    IsRead = false,
                    CreatedAt = DateTime.UtcNow
                });

                await _context.SaveChangesAsync();

                _logger.LogInformation("Đã tạo đơn GHN {GhnCode} cho đơn hàng #{OrderId} → Shipped", result.OrderCode, orderId);

                try
                {
                    await _hubContext.Clients.User(order.UserId.ToString())
                        .SendAsync("ReceiveStatusUpdate", order.Id, OrderStatus.Shipped.ToString());
                }
                catch (Exception ex)
                {
                    _logger.LogWarning("SignalR notify failed for user {UserId}: {Message}", order.UserId, ex.Message);
                }

                var responseData = new
                {
                    ghnOrderCode = result.OrderCode,
                    orderStatus = OrderStatus.Shipped.ToString(),
                    shippingStatus = "ready_to_pick",
                    message = $"Đã tạo vận đơn GHN thành công. Mã: {result.OrderCode}"
                };

                return (true, $"Đã tạo vận đơn GHN thành công. Mã: {result.OrderCode}", 200, responseData);
            }
            catch (InvalidOperationException ex)
            {
                _logger.LogWarning("GHN create error (order #{OrderId}): {Message}", orderId, ex.Message);
                return (false, ex.Message, 400, null);
            }
        }

        public async Task<(bool Success, string Message, int StatusCode, object? Data)> SetGhnCodeManuallyAsync(int orderId, string ghnOrderCode)
        {
            if (string.IsNullOrWhiteSpace(ghnOrderCode))
                return (false, "Mã GHN không được để trống.", 400, null);

            var order = await _context.Orders.FindAsync(orderId);
            if (order == null)
                return (false, "Không tìm thấy đơn hàng.", 404, null);

            if (!string.IsNullOrWhiteSpace(order.GhnOrderCode))
                return (false, $"Đơn đã có mã GHN: {order.GhnOrderCode}. Hủy vận đơn cũ trước.", 400, null);

            order.GhnOrderCode = ghnOrderCode.Trim();
            order.ShippingStatus = "ready_to_pick";
            order.Status = OrderStatus.Shipped;
            order.UpdatedAt = DateTime.UtcNow;

            _context.Notifications.Add(new Notification
            {
                UserId = order.UserId,
                Message = $"Đơn hàng #{order.Id} của bạn đã chuyển sang trạng thái: [Đang giao hàng] (Mã vận đơn: {ghnOrderCode.Trim()})",
                Type = "Info",
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();

            _logger.LogInformation("Admin nhập thủ công mã GHN {GhnCode} cho đơn hàng #{OrderId} → Shipped", ghnOrderCode, orderId);

            try
            {
                await _hubContext.Clients.User(order.UserId.ToString())
                    .SendAsync("ReceiveStatusUpdate", order.Id, OrderStatus.Shipped.ToString());
            }
            catch { /* ignore SignalR errors */ }

            var responseData = new
            {
                ghnOrderCode = order.GhnOrderCode,
                orderStatus = OrderStatus.Shipped.ToString(),
                message = $"Đã liên kết mã GHN {order.GhnOrderCode} với đơn hàng #{orderId}."
            };

            return (true, $"Đã liên kết mã GHN {order.GhnOrderCode} với đơn hàng #{orderId}.", 200, responseData);
        }

        public async Task<(bool Success, string Message, int StatusCode)> CancelShipmentAsync(int orderId, string ghnOrderCode)
        {
            try
            {
                var order = await _context.Orders.FindAsync(orderId);
                if (order == null)
                    return (false, "Không tìm thấy đơn hàng.", 404);

                await _ghn.CancelShippingOrderAsync(ghnOrderCode);

                order.GhnOrderCode = null;
                order.ShippingStatus = "cancel";
                order.Status = OrderStatus.Processing;
                order.UpdatedAt = DateTime.UtcNow;

                _context.Notifications.Add(new Notification
                {
                    UserId = order.UserId,
                    Message = $"Đơn hàng #{order.Id} của bạn đã chuyển sang trạng thái: [Đang xử lý] (Vận đơn giao hàng đã bị hủy)",
                    Type = "Info",
                    IsRead = false,
                    CreatedAt = DateTime.UtcNow
                });

                await _context.SaveChangesAsync();

                try
                {
                    await _hubContext.Clients.User(order.UserId.ToString())
                        .SendAsync("ReceiveStatusUpdate", order.Id, OrderStatus.Processing.ToString());
                }
                catch { /* ignore SignalR errors */ }

                return (true, $"Đã hủy đơn vận chuyển {ghnOrderCode}. Đơn hàng trở về trạng thái Đang xử lý.", 200);
            }
            catch (InvalidOperationException ex)
            {
                return (false, ex.Message, 400);
            }
        }

        public async Task<bool> HandleGhnWebhookAsync(GhnWebhookPayload payload)
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

                    bool isDelivered = false;
                    if (payload.Status == "delivered" && order.Status == OrderStatus.Shipped)
                    {
                        order.Status = OrderStatus.Delivered;
                        order.PaymentStatus = "Completed";
                        isDelivered = true;
                    }

                    order.UpdatedAt = DateTime.UtcNow;

                    if (isDelivered)
                    {
                        _context.Notifications.Add(new Notification
                        {
                            UserId = order.UserId,
                            Message = $"Đơn hàng #{order.Id} của bạn đã được giao thành công!",
                            Type = "Success",
                            IsRead = false,
                            CreatedAt = DateTime.UtcNow
                        });
                    }

                    await _context.SaveChangesAsync();

                    try
                    {
                        await _hubContext.Clients.User(order.UserId.ToString())
                            .SendAsync("ReceiveStatusUpdate", order.Id, order.Status.ToString());
                    }
                    catch { /* ignore */ }
                }
            }

            await _hubContext.Clients.All.SendAsync(
                "ReceiveShippingUpdate",
                payload.ClientOrderCode,
                payload.Status,
                payload.Description);

            return true;
        }
    }
}
