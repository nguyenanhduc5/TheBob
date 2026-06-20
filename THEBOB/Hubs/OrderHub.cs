using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Authorization;

namespace THEBOB.Hubs
{
    /// <summary>
    /// SignalR Hub for handling real-time order updates.
    /// </summary>
    [Authorize]
    public class OrderHub : Hub
    {
    }
}