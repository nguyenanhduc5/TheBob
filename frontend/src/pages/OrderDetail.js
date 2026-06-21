import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { ordersAPI } from '../api/app';
import '../styles/OrderDetail.css';

export default function OrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { addNotification } = useNotification();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    try {
      const data = await ordersAPI.getOrder(orderId);
      setOrder(data);
    } catch (error) {
      console.error('Failed to fetch order:', error);
      addNotification(error.message || 'Lỗi khi tải đơn hàng', 'error');
      navigate(isAdmin() ? '/admin/orders' : '/user/profile?menu=orders');
    } finally {
      setLoading(false);
    }
  }, [addNotification, isAdmin, navigate, orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  useEffect(() => {
    const handleOrderStatusUpdate = (event) => {
      if (Number(event.detail.orderId) === Number(orderId)) {
        console.log('OrderDetail page received status update for this order:', event.detail);
        fetchOrder();
      }
    };
    window.addEventListener('order-status-updated', handleOrderStatusUpdate);
    return () => {
      window.removeEventListener('order-status-updated', handleOrderStatusUpdate);
    };
  }, [fetchOrder, orderId]);

  const handleCancelOrder = async () => {
    if (!window.confirm('Xác nhận hủy đơn hàng này?')) return;

    setCancelling(true);
    try {
      const updatedOrder = await ordersAPI.cancelOrder(orderId);
      setOrder(updatedOrder);
      addNotification('Đã hủy đơn hàng', 'success');
    } catch (error) {
      addNotification(error.message || 'Không thể hủy đơn hàng', 'error');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return <div className="loading-page">Đang tải thông tin đơn hàng...</div>;
  }

  if (!order) {
    return <div className="error-page">Không tìm thấy đơn hàng</div>;
  }

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'PendingPayment':
        return 'status-pending';
      case 'Pending':
        return 'status-pending';
      case 'Processing':
        return 'status-processing';
      case 'Paid':
        return 'status-processing';
      case 'Shipped':
        return 'status-shipped';
      case 'Delivered':
        return 'status-delivered';
      case 'Cancelled':
        return 'status-cancelled';
      default:
        return '';
    }
  };

  const getStatusLabel = (status) => {
    const statusMap = {
      'PendingPayment': 'Chờ thanh toán',
      'Pending': 'Chờ xử lý',
      'Processing': 'Đang xử lý',
      'Paid': 'Đã thanh toán',
      'Shipped': 'Đang giao',
      'Delivered': 'Đã giao',
      'Cancelled': 'Đã hủy',
    };
    return statusMap[status] || status;
  };

  return (
    <div className="order-detail-page">
      <div className="order-header">
        <h1>Chi Tiết Đơn Hàng</h1>
        <button onClick={() => navigate(isAdmin() ? '/admin/orders' : '/user/profile?menu=orders')} className="btn-back">
          ← Quay lại
        </button>
      </div>

      <div className="order-container">
        <div className="order-info-section">
          <div className="info-card">
            <h2>Thông Tin Đơn Hàng</h2>
            <div className="info-row">
              <span className="label">Mã đơn hàng:</span>
              <span className="value">{order.orderNumber || order.id}</span>
            </div>
            <div className="info-row">
              <span className="label">Ngày đặt hàng:</span>
              <span className="value">
                {new Date(order.createdAt).toLocaleDateString('vi-VN')}
              </span>
            </div>
            <div className="info-row">
              <span className="label">Trạng thái:</span>
              <span className={`status ${getStatusBadgeClass(order.status)}`}>
                {getStatusLabel(order.status)}
              </span>
            </div>
            <div className="info-row">
              <span className="label">Tổng tiền:</span>
              <span className="value total">
                {order.totalAmount.toLocaleString('vi-VN')} VNĐ
              </span>
            </div>
          </div>

          <div className="info-card">
            <h2>Địa Chỉ Giao Hàng</h2>
            <div className="shipping-address">
              <p>{order.shippingAddress}</p>
            </div>
          </div>

          <div className="info-card">
            <h2>Phương Thức Thanh Toán</h2>
            <p>{order.paymentMethod || 'Chưa xác định'}</p>
          </div>
        </div>

        <div className="order-items-section">
          <div className="items-card">
            <h2>Sản Phẩm Đã Đặt</h2>
            <div className="items-table">
              <div className="items-header">
                <span className="col-name">Sản Phẩm</span>
                <span className="col-price">Đơn Giá</span>
                <span className="col-quantity">Số Lượng</span>
                <span className="col-total">Thành Tiền</span>
              </div>

              {order.items && order.items.map((item) => (
                <div key={item.id} className="item-row">
                  <span className="col-name">
                    <div>
                      {item.productName}
                      {item.size && <span className="item-meta"> - Kích thước: {item.size}</span>}
                    </div>
                  </span>
                  <span className="col-price">
                    {item.price.toLocaleString('vi-VN')} VNĐ
                  </span>
                  <span className="col-quantity">{item.quantity}</span>
                  <span className="col-total">
                    {(item.price * item.quantity).toLocaleString('vi-VN')} VNĐ
                  </span>
                </div>
              ))}
            </div>

            <div className="order-summary">
              <div className="summary-row">
                <span>Tạm tính:</span>
                <span>
                  {(order.subtotal ?? order.totalAmount).toLocaleString('vi-VN')} VNĐ
                </span>
              </div>
              <div className="summary-row">
                <span>Phí vận chuyển:</span>
                <span>{(order.shippingAmount ?? 0).toLocaleString('vi-VN')} VNĐ</span>
              </div>
              <div className="summary-row total">
                <span>Tổng cộng:</span>
                <span>{order.totalAmount.toLocaleString('vi-VN')} VNĐ</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="order-actions">
        <button onClick={() => navigate('/products')} className="btn-continue-shopping">
          Tiếp Tục Mua Sắm
        </button>
        {order.status === 'Delivered' && (
          <button className="btn-review">
            Đánh Giá Sản Phẩm
          </button>
        )}
        {!isAdmin() && (order.status === 'Pending' || order.status === 'Processing') && (
          <button className="btn-cancel" onClick={handleCancelOrder} disabled={cancelling}>
            {cancelling ? 'Đang hủy...' : 'Hủy Đơn Hàng'}
          </button>
        )}
      </div>
    </div>
  );
}
