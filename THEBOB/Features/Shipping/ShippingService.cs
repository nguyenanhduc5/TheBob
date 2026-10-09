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
                if (string.IsNullOrWhiteSpace(result.OrderCode))
                    throw new InvalidOperationException("GHN không trả về mã vận đơn hợp lệ.");

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

            if (order.Status != OrderStatus.Processing)
                return (false, "Chỉ có thể gắn mã GHN cho đơn hàng đang xử lý.", 400, null);

            if (!string.IsNullOrWhiteSpace(order.GhnOrderCode))
                return (false, $"Đơn đã có mã GHN: {order.GhnOrderCode}. Hủy vận đơn cũ trước.", 400, null);

            var normalizedCode = ghnOrderCode.Trim();
            if (await _context.Orders.AnyAsync(o => o.Id != orderId && o.GhnOrderCode == normalizedCode))
                return (false, "Mã GHN này đã được liên kết với một đơn hàng khác.", 409, null);

            GhnTrackingResponse tracking;
            try
            {
                tracking = await _ghn.GetTrackingAsync(normalizedCode);
            }
            catch (InvalidOperationException ex)
            {
                return (false, $"Không thể xác minh mã GHN: {ex.Message}", 400, null);
            }

            if (!string.Equals(tracking.OrderCode, normalizedCode, StringComparison.OrdinalIgnoreCase))
                return (false, "GHN không xác nhận mã vận đơn này.", 400, null);

            if (!string.IsNullOrWhiteSpace(tracking.ClientOrderCode)
                && !string.Equals(tracking.ClientOrderCode, order.OrderNumber, StringComparison.OrdinalIgnoreCase))
                return (false, "Mã vận đơn GHN đang thuộc về một đơn hàng khác.", 409, null);
            if (string.IsNullOrWhiteSpace(tracking.Status))
                return (false, "GHN chưa trả về trạng thái vận chuyển của mã này.", 400, null);
            if (string.Equals(tracking.Status, "cancel", StringComparison.OrdinalIgnoreCase)
                || string.Equals(tracking.Status, "returned", StringComparison.OrdinalIgnoreCase))
                return (false, "Vận đơn GHN này đã kết thúc, không thể liên kết vào đơn hàng đang xử lý.", 400, null);

            order.GhnOrderCode = normalizedCode;
            order.ShippingStatus = tracking.Status;
            order.Status = string.Equals(tracking.Status, "delivered", StringComparison.OrdinalIgnoreCase)
                ? OrderStatus.Delivered
                : OrderStatus.Shipped;
            if (order.Status == OrderStatus.Delivered)
                order.PaymentStatus = "Completed";
            order.UpdatedAt = DateTime.UtcNow;

            _context.Notifications.Add(new Notification
            {
                UserId = order.UserId,
                Message = order.Status == OrderStatus.Delivered
                    ? $"Đơn hàng #{order.Id} của bạn đã được giao thành công!"
                    : $"Đơn hàng #{order.Id} của bạn đã chuyển sang trạng thái: [Đang giao hàng] (Mã vận đơn: {normalizedCode})",
                Type = order.Status == OrderStatus.Delivered ? "Success" : "Info",
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();

            _logger.LogInformation("Admin liên kết mã GHN {GhnCode} cho đơn hàng #{OrderId} → {OrderStatus}", normalizedCode, orderId, order.Status);

            try
            {
                await _hubContext.Clients.User(order.UserId.ToString())
                    .SendAsync("ReceiveStatusUpdate", order.Id, order.Status.ToString());
            }
            catch { /* ignore SignalR errors */ }

            var responseData = new
            {
                ghnOrderCode = order.GhnOrderCode,
                orderStatus = order.Status.ToString(),
                shippingStatus = order.ShippingStatus,
                tracking,
                message = $"Đã liên kết mã GHN {order.GhnOrderCode} với đơn hàng #{orderId}."
            };

            return (true, $"Đã liên kết mã GHN {order.GhnOrderCode} với đơn hàng #{orderId}.", 200, responseData);
        }

        public async Task<(bool Success, string Message, int StatusCode, object? Data)> RefreshOrderTrackingAsync(int orderId)
        {
            var order = await _context.Orders.FirstOrDefaultAsync(o => o.Id == orderId);
            if (order == null)
                return (false, "Không tìm thấy đơn hàng.", 404, null);

            if (string.IsNullOrWhiteSpace(order.GhnOrderCode))
                return (false, "Đơn hàng chưa có mã vận đơn GHN.", 400, null);

            GhnTrackingResponse tracking;
            try
            {
                tracking = await _ghn.GetTrackingAsync(order.GhnOrderCode);
            }
            catch (InvalidOperationException ex)
            {
                _logger.LogWarning(ex, "GHN tracking failed for order #{OrderId}", orderId);
                return (false, $"Không thể lấy trạng thái từ GHN: {ex.Message}", 502, null);
            }

            if (!string.Equals(tracking.OrderCode, order.GhnOrderCode, StringComparison.OrdinalIgnoreCase))
                return (false, "Mã vận đơn trả về từ GHN không khớp với đơn hàng.", 502, null);

            if (!string.IsNullOrWhiteSpace(tracking.ClientOrderCode)
                && !string.Equals(tracking.ClientOrderCode, order.OrderNumber, StringComparison.OrdinalIgnoreCase))
                return (false, "GHN trả về mã đơn hàng nội bộ không khớp.", 409, null);

            if (string.IsNullOrWhiteSpace(tracking.Status))
                return (false, "GHN chưa trả về trạng thái vận chuyển.", 502, null);

            var previousStatus = order.Status;
            order.ShippingStatus = tracking.Status;
            if (string.Equals(tracking.Status, "delivered", StringComparison.OrdinalIgnoreCase)
                && order.Status == OrderStatus.Shipped)
            {
                order.Status = OrderStatus.Delivered;
                order.PaymentStatus = "Completed";
            }
            else if (string.Equals(tracking.Status, "cancel", StringComparison.OrdinalIgnoreCase)
                && order.Status == OrderStatus.Shipped)
            {
                order.GhnOrderCode = null;
                order.Status = OrderStatus.Processing;
            }
            order.UpdatedAt = DateTime.UtcNow;

            if (previousStatus != order.Status)
            {
                var isDelivered = order.Status == OrderStatus.Delivered;
                _context.Notifications.Add(new Notification
                {
                    UserId = order.UserId,
                    Message = isDelivered
                        ? $"Đơn hàng #{order.Id} của bạn đã được giao thành công!"
                        : $"Vận đơn GHN đã bị hủy. Đơn hàng #{order.Id} đang chờ xử lý vận chuyển lại.",
                    Type = isDelivered ? "Success" : "Info",
                    IsRead = false,
                    CreatedAt = DateTime.UtcNow
                });
            }
            await _context.SaveChangesAsync();

            if (previousStatus != order.Status)
            {
                await _hubContext.Clients.All.SendAsync(
                    "ReceiveStatusUpdate", order.Id, order.Status.ToString());
            }
            await _hubContext.Clients.All.SendAsync(
                "ReceiveShippingUpdate", order.OrderNumber, tracking.Status, tracking.StatusName);

            return (true, "Đã đồng bộ trạng thái vận chuyển từ GHN.", 200, new
            {
                ghnOrderCode = order.GhnOrderCode,
                orderStatus = order.Status.ToString(),
                shippingStatus = order.ShippingStatus,
                tracking
            });
        }

        public async Task<(bool Success, string Message, int StatusCode)> CancelShipmentAsync(int orderId, string ghnOrderCode)
        {
            try
            {
                var order = await _context.Orders.FindAsync(orderId);
                if (order == null)
                    return (false, "Không tìm thấy đơn hàng.", 404);

                if (string.IsNullOrWhiteSpace(order.GhnOrderCode)
                    || !string.Equals(order.GhnOrderCode, ghnOrderCode?.Trim(), StringComparison.OrdinalIgnoreCase))
                    return (false, "Mã vận đơn không khớp với đơn hàng.", 409);

                if (order.Status != OrderStatus.Shipped)
                    return (false, "Chỉ có thể hủy vận đơn của đơn hàng đang được GHN vận chuyển.", 400);

                var normalizedCode = order.GhnOrderCode;
                await _ghn.CancelShippingOrderAsync(normalizedCode);

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

                return (true, $"Đã hủy đơn vận chuyển {normalizedCode}. Đơn hàng trở về trạng thái Đang xử lý.", 200);
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

            if (!string.IsNullOrWhiteSpace(payload.ClientOrderCode) || !string.IsNullOrWhiteSpace(payload.OrderCode))
            {
                var order = await _context.Orders.FirstOrDefaultAsync(o =>
                    (!string.IsNullOrWhiteSpace(payload.ClientOrderCode) && o.OrderNumber == payload.ClientOrderCode)
                    || (!string.IsNullOrWhiteSpace(payload.OrderCode) && o.GhnOrderCode == payload.OrderCode));

                if (order != null)
                {
                    var previousOrderStatus = order.Status;
                    bool isDelivered = false;
                    bool shipmentCancelled = false;
                    var matchesShipment = !string.IsNullOrWhiteSpace(order.GhnOrderCode)
                        && !string.IsNullOrWhiteSpace(payload.OrderCode)
                        && string.Equals(order.GhnOrderCode, payload.OrderCode, StringComparison.OrdinalIgnoreCase);
                    if (!matchesShipment)
                    {
                        _logger.LogWarning(
                            "Ignoring GHN webhook for order {OrderNumber}: code {ReceivedCode} does not match stored shipment {StoredCode}",
                            order.OrderNumber,
                            payload.OrderCode,
                            order.GhnOrderCode);
                    }
                    else
                    {
                        order.ShippingStatus = payload.Status;
                        order.UpdatedAt = DateTime.UtcNow;

                        if (string.Equals(payload.Status, "delivered", StringComparison.OrdinalIgnoreCase)
                            && order.Status == OrderStatus.Shipped)
                        {
                            order.Status = OrderStatus.Delivered;
                            order.PaymentStatus = "Completed";
                            isDelivered = true;
                        }
                        else if (string.Equals(payload.Status, "cancel", StringComparison.OrdinalIgnoreCase)
                            && order.Status == OrderStatus.Shipped)
                        {
                            order.GhnOrderCode = null;
                            order.Status = OrderStatus.Processing;
                            shipmentCancelled = true;
                        }
                    }

                    if (matchesShipment)
                    {
                        if (isDelivered || (shipmentCancelled && previousOrderStatus != order.Status))
                        {
                            _context.Notifications.Add(new Notification
                            {
                                UserId = order.UserId,
                                Message = isDelivered
                                    ? $"Đơn hàng #{order.Id} của bạn đã được giao thành công!"
                                    : $"Vận đơn GHN đã bị hủy. Đơn hàng #{order.Id} đang chờ xử lý vận chuyển lại.",
                                Type = isDelivered ? "Success" : "Info",
                                IsRead = false,
                                CreatedAt = DateTime.UtcNow
                            });
                        }

                        await _context.SaveChangesAsync();

                        try
                        {
                            await _hubContext.Clients.User(order.UserId.ToString())
                                .SendAsync("ReceiveStatusUpdate", order.Id, order.Status.ToString());
                            await _hubContext.Clients.All.SendAsync(
                                "ReceiveShippingUpdate",
                                payload.ClientOrderCode,
                                payload.Status,
                                payload.Description);
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "SignalR notify failed for GHN order {GhnOrderCode}", payload.OrderCode);
                        }
                    }
                }
            }

            return true;
        }
    }
}
