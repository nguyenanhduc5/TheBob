using THEBOB.Models;

namespace THEBOB.Services;

public static class GhnOrderRequestBuilder
{
    public static GhnCreateOrderRequest FromOrder(
        Order order,
        IEnumerable<OrderItem> items,
        string? toName = null,
        string? toPhone = null,
        string? toAddress = null)
    {
        var itemList = items.ToList();
        var weight = Math.Max(itemList.Sum(i => i.Quantity * 500), 200);
        var isCod = order.PaymentMethod.Equals("cod", StringComparison.OrdinalIgnoreCase);

        return new GhnCreateOrderRequest
        {
            PaymentTypeId = isCod ? "2" : "1",
            Note = $"Đơn hàng {order.OrderNumber}",
            RequiredNote = "KHONGCHOXEMHANG",
            ToName = toName ?? order.User?.FullName ?? order.User?.Email ?? "Khách hàng",
            ToPhone = toPhone ?? order.User?.Phone ?? string.Empty,
            ToAddress = toAddress ?? order.ShippingAddress,
            ToWardCode = order.GhnWardCode!,
            ToDistrictId = order.GhnDistrictId!.Value,
            Weight = weight,
            Length = 20,
            Width = 20,
            Height = 10,
            InsuranceValue = (long)Math.Round(order.TotalAmount),
            ServiceTypeId = 2,
            CodAmount = isCod ? (int)Math.Round(order.TotalAmount) : 0,
            ClientOrderCode = order.OrderNumber,
            Content = string.Join(", ", itemList.Select(i => i.ProductName)),
            Items = itemList.Select(i => new GhnOrderItem
            {
                Name = i.ProductName,
                Code = i.VariantId ?? 0,
                Quantity = i.Quantity,
                Price = (int)i.PricePerItem,
                Length = 20,
                Width = 20,
                Height = 10,
                Weight = 500
            }).ToList()
        };
    }

    public static GhnCreateOrderRequest FromCheckout(
        Order order,
        IEnumerable<(CartItem Item, int WeightGrams)> cartLines,
        string toName,
        string toPhone,
        string toAddress,
        int totalWeight)
    {
        var lines = cartLines.ToList();
        var weight = Math.Max(totalWeight, 200);

        return new GhnCreateOrderRequest
        {
            PaymentTypeId = "2",
            Note = $"Đơn hàng {order.OrderNumber}",
            RequiredNote = "KHONGCHOXEMHANG",
            ToName = toName,
            ToPhone = toPhone,
            ToAddress = toAddress,
            ToWardCode = order.GhnWardCode!,
            ToDistrictId = order.GhnDistrictId!.Value,
            Weight = weight,
            Length = 20,
            Width = 20,
            Height = 10,
            InsuranceValue = (long)Math.Round(order.TotalAmount),
            ServiceTypeId = 2,
            CodAmount = (int)Math.Round(order.TotalAmount),
            ClientOrderCode = order.OrderNumber,
            Content = string.Join(", ", lines.Select(l => l.Item.Variant!.Product!.Name)),
            Items = lines.Select(l => new GhnOrderItem
            {
                Name = l.Item.Variant!.Product!.Name,
                Code = l.Item.Variant.Id,
                Quantity = l.Item.Quantity,
                Price = (int)l.Item.Variant.Price,
                Length = 20,
                Width = 20,
                Height = 10,
                Weight = 500
            }).ToList()
        };
    }
}
