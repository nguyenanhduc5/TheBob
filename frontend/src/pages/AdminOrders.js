import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import '../styles/AdminOrders.css';
import AdminLayout from '../components/AdminLayout';

export default function AdminOrders() {
  const navigate = useNavigate();
  const { token, isAdmin } = useAuth();
  const { addNotification } = useNotification();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/orders/admin/all`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        let data = await response.json();
        
        // Filter by status if needed
        if (filter !== 'all') {
          data = data.filter(order => order.status === filter);
        }
        
        setOrders(data);
      } else {
        let message = 'Lỗi khi tải đơn hàng';
        try {
          const errorData = await response.json();
          message = errorData?.message || message;
        } catch {}
        addNotification(message, 'error');
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      addNotification('Lỗi khi tải đơn hàng', 'error');
    } finally {
      setLoading(false);
    }
  }, [token, filter, addNotification]);

  useEffect(() => {
    if (!isAdmin()) {
      navigate('/');
      return;
    }
    fetchOrders();
  }, [fetchOrders, isAdmin, navigate]);

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        addNotification('Cập nhật trạng thái thành công', 'success');
        fetchOrders();
      } else {
        let message = 'Lỗi khi cập nhật trạng thái';
        try {
          const errorData = await response.json();
          message = errorData?.message || message;
        } catch {}
        addNotification(message, 'error');
      }
    } catch (error) {
      console.error('Status update error:', error);
      addNotification('Lỗi khi cập nhật trạng thái', 'error');
    }
  };

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

  if (loading) {
    return <div className="loading-page">Đang tải...</div>;
  }

  return (
    <AdminLayout title="Quản Lý Đơn Hàng">
      <div className="admin-orders-page">
      <div className="admin-header">
        <h1>Quản Lý Đơn Hàng</h1>
      </div>

      <div className="orders-filters">
        <button
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          Tất Cả ({orders.length})
        </button>
        <button
          className={`filter-btn ${filter === 'Pending' ? 'active' : ''}`}
          onClick={() => setFilter('Pending')}
        >
          Chờ Xử Lý
        </button>
        <button
          className={`filter-btn ${filter === 'Processing' ? 'active' : ''}`}
          onClick={() => setFilter('Processing')}
        >
          Đang Xử Lý
        </button>
        <button
          className={`filter-btn ${filter === 'Shipped' ? 'active' : ''}`}
          onClick={() => setFilter('Shipped')}
        >
          Đang Giao
        </button>
        <button
          className={`filter-btn ${filter === 'Delivered' ? 'active' : ''}`}
          onClick={() => setFilter('Delivered')}
        >
          Đã Giao
        </button>
      </div>

      {orders.length === 0 ? (
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

          {orders.map((order) => (
            <div key={order.id} className="table-row">
              <span className="col-id">#{order.id}</span>
              <span className="col-customer">
                {order.customerName || 'Không xác định'}
              </span>
              <span className="col-date">
                {new Date(order.createdAt).toLocaleDateString('vi-VN')}
              </span>
              <span className="col-total">
                {order.totalAmount.toLocaleString('vi-VN')} VNĐ
              </span>
              <span className="col-status">
                <select
                  value={order.status}
                  onChange={(e) => handleStatusChange(order.id, e.target.value)}
                  className={`status-select ${getStatusBadgeClass(order.status)}`}
                >
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
              </span>
            </div>
          ))}
        </div>
      )}
      </div>
    </AdminLayout>
  );
}
