import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import '../styles/OrderDetail.css';

export default function OrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const { addNotification } = useNotification();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchOrder = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/orders/${orderId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setOrder(data);
      } else {
        addNotification('Không tìm thấy đơn hàng', 'error');
        navigate('/user/profile');
      }
    } catch (error) {
      console.error('Failed to fetch order:', error);
      addNotification('Lỗi khi tải đơn hàng', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [orderId, fetchOrder]);
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
      case 'Pending':
        return 'status-pending';
      case 'Processing':
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
      'Pending': 'Chờ xử lý',
      'Processing': 'Đang xử lý',
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
        <button onClick={() => navigate('/user/profile')} className="btn-back">
          ← Quay lại
        </button>
      </div>

      <div className="order-container">
        {/* Order Info */}
        <div className="order-info-section">
          <div className="info-card">
            <h2>Thông Tin Đơn Hàng</h2>
            <div className="info-row">
              <span className="label">Mã đơn hàng:</span>
              <span className="value">{order.id}</span>
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

        {/* Order Items */}
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
                  {(order.totalAmount - 30000).toLocaleString('vi-VN')} VNĐ
                </span>
              </div>
              <div className="summary-row">
                <span>Phí vận chuyển:</span>
                <span>30,000 VNĐ</span>
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
        {(order.status === 'Pending' || order.status === 'Processing') && (
          <button className="btn-cancel">
            Hủy Đơn Hàng
          </button>
        )}
      </div>
    </div>
  );
}
