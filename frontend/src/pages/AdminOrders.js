import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { ordersAPI, paymentAPI } from '../api/app';
import '../styles/AdminOrders.css';
import LoadingSkeleton from '../components/LoadingSkeleton';

export default function AdminOrders() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { addNotification } = useNotification();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const data = await ordersAPI.getAllOrders();
      
      // Sắp xếp đơn hàng mới nhất lên đầu
      data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      setOrders(data);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      addNotification('Lỗi khi tải đơn hàng', 'error');
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => {
    if (!isAdmin()) {
      navigate('/');
      return;
    }
    fetchOrders();
  }, [fetchOrders, isAdmin, navigate, refreshKey]);

  const handleStatusChange = async (orderId, newStatus) => {
    if (!window.confirm(`Xác nhận thay đổi trạng thái đơn hàng sang: ${newStatus}?`)) return;
    
    setUpdatingId(orderId);
    try {
      await ordersAPI.updateOrderStatus(orderId, newStatus);
      addNotification('Cập nhật trạng thái thành công', 'success');
      // Cập nhật local state ngay lập tức để giao diện mượt mà không reload trang
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    } catch (error) {
      addNotification(error.message || 'Lỗi khi cập nhật trạng thái', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleConfirmPayment = async (orderId) => {
    if (!window.confirm('Xác nhận thanh toán cho đơn hàng này? Trạng thái đơn hàng sẽ tự động đổi thành Đang xử lý.')) return;

    setUpdatingId(orderId);
    try {
      await paymentAPI.confirmPayment({ orderId });
      addNotification('Xác nhận thanh toán thành công!', 'success');
      // Cập nhật local state tức thì
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, paymentStatus: 'Paid', status: 'Processing' } : o));
    } catch (error) {
      addNotification(error.message || 'Lỗi khi xác nhận thanh toán', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'PendingPayment':
        return 'status-waiting';
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

  const getCount = (status) => {
    if (status === 'all') return orders.length;
    return orders.filter(o => o.status === status).length;
  };

  const filteredOrders = filter === 'all' 
    ? orders 
    : orders.filter(o => o.status === filter);

  if (loading) {
    return <LoadingSkeleton type="table" />;
  }

  return (
    <div className="admin-orders-page">
      <div className="admin-header">
        <div>
          <h1>Quản Lý Đơn Hàng</h1>
          <p>Xem và cập nhật trạng thái các đơn hàng trong hệ thống</p>
        </div>
        <button className="btn-refresh" onClick={() => setRefreshKey(prev => prev + 1)}>
          🔄 Làm mới dữ liệu
        </button>
      </div>

      <div className="orders-filters">
        <button
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          Tất Cả ({getCount('all')})
        </button>
        <button
          className={`filter-btn ${filter === 'PendingPayment' ? 'active' : ''}`}
          onClick={() => setFilter('PendingPayment')}
        >
          Chờ Thanh Toán ({getCount('PendingPayment')})
        </button>
        <button
          className={`filter-btn ${filter === 'Pending' ? 'active' : ''}`}
          onClick={() => setFilter('Pending')}
        >
          Chờ Xử Lý ({getCount('Pending')})
        </button>
        <button
          className={`filter-btn ${filter === 'Processing' ? 'active' : ''}`}
          onClick={() => setFilter('Processing')}
        >
          Đang Xử Lý ({getCount('Processing')})
        </button>
        <button
          className={`filter-btn ${filter === 'Shipped' ? 'active' : ''}`}
          onClick={() => setFilter('Shipped')}
        >
          Đang Giao ({getCount('Shipped')})
        </button>
        <button
          className={`filter-btn ${filter === 'Delivered' ? 'active' : ''}`}
          onClick={() => setFilter('Delivered')}
        >
          Đã Giao ({getCount('Delivered')})
        </button>
        <button
          className={`filter-btn ${filter === 'Cancelled' ? 'active' : ''}`}
          onClick={() => setFilter('Cancelled')}
        >
          Đã Hủy ({getCount('Cancelled')})
        </button>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="no-orders">Không có đơn hàng nào</div>
      ) : (
        <div className="orders-table">
          <div className="table-header">
            <span className="col-id">Mã ĐH</span>
            <span className="col-customer">Khách Hàng</span>
            <span className="col-date">Ngày Đặt</span>
            <span className="col-total">Tổng Tiền</span>
            <span className="col-status">Trạng Thái</span>
            <span className="col-actions">Thao Tác</span>
          </div>

          {filteredOrders.map((order) => (
            <div key={order.id} className="table-row">
              <span className="col-id">#{order.id}</span>
              <span className="col-customer">
                <div style={{ fontWeight: '600' }}>{order.customerName || 'Không xác định'}</div>
                <div className="payment-method-badge">
                  {order.paymentMethod === 'cod' ? 'COD' : order.paymentMethod === 'bank_transfer' ? 'Chuyển khoản' : order.paymentMethod === 'qr' ? 'QR Code' : order.paymentMethod}
                </div>
              </span>
              <span className="col-date">
                {new Date(order.createdAt).toLocaleDateString('vi-VN')}
              </span>
              <span className="col-total">
                <div>{order.totalAmount.toLocaleString('vi-VN')} VNĐ</div>
                <div className={`payment-status ${order.paymentStatus === 'Paid' ? 'paid' : 'pending'}`}>
                  {order.paymentStatus === 'Paid' ? 'Đã thanh toán' : 'Chưa thanh toán'}
                </div>
              </span>
              <span className="col-status">
                <select
                  aria-label="Cập nhật trạng thái đơn hàng"
                  title="Chọn trạng thái mới cho đơn hàng"
                  value={order.status}
                  disabled={updatingId === order.id}
                  onChange={(e) => handleStatusChange(order.id, e.target.value)}
                  className={`status-select ${getStatusBadgeClass(order.status)}`}
                >
                  <option value="PendingPayment">Chờ thanh toán</option>
                  <option value="Pending">Chờ xử lý</option>
                  <option value="Processing">Đang xử lý</option>
                  <option value="Shipped">Đang giao</option>
                  <option value="Delivered">Đã giao</option>
                  <option value="Cancelled">Đã hủy</option>
                </select>
              </span>
              <span className="col-actions">
                <button
                  onClick={() => navigate(`/orders/${order.id}`)}
                  className="btn-view"
                >
                  Chi Tiết
                </button>
                {order.paymentStatus !== 'Paid' && (order.paymentMethod === 'bank_transfer' || order.paymentMethod === 'qr') && (
                  <button
                    onClick={() => handleConfirmPayment(order.id)}
                    className="btn-confirm-payment"
                    disabled={updatingId === order.id}
                  >
                    Xác nhận TT
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
