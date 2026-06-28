// Services/AdminNotifier.cs
using Microsoft.AspNetCore.SignalR;
using THEBOB.Hubs;
using THEBOB.Models;

namespace THEBOB.Services;

public static class AdminNotifier
{
    public static Task NotifyAdminNewOrder(IHubContext<OrderHub> hub, Order order)
    {
        return hub.Clients.Group("Admins").SendAsync("ReceiveNewOrder", new
        {
            orderId = order.Id,
            orderNumber = order.OrderNumber,
            totalAmount = order.TotalAmount,
            shippingFee = order.ShippingFee,
            paymentMethod = order.PaymentMethod,
            ghnOrderCode = order.GhnOrderCode,
            createdAt = order.CreatedAt
        });
    }
}