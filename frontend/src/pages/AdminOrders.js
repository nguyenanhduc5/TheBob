import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as signalR from '@microsoft/signalr';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { ordersAPI, ORDER_HUB_URL } from '../api/app';
import '../styles/AdminOrders.css';
import LoadingSkeleton from '../components/LoadingSkeleton';

const FILTERS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'pending', label: 'Chờ thanh toán' },
  { key: 'paid', label: 'Đã thanh toán' },
  { key: 'cancelled', label: 'Đã hủy' }
];

export default function AdminOrders() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { addNotification } = useNotification();
  const connectionRef = useRef(null);

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);

  const playTingTing = useCallback(() => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      const audioContext = new AudioContextClass();

      // Tạo hai nốt ngắn liên tiếp bằng Web Audio API, không cần file mp3.
      [880, 1320].forEach((frequency, index) => {
        const startAt = audioContext.currentTime + index * 0.16;
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, startAt);
        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(0.18, startAt + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.13);

        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start(startAt);
        oscillator.stop(startAt + 0.14);
      });

      setTimeout(() => audioContext.close?.(), 600);
    } catch (error) {
      console.error('Unable to play admin notification tone:', error);
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const data = await ordersAPI.getAllOrders();
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
  }, [fetchOrders, isAdmin, navigate]);

  useEffect(() => {
    if (!isAdmin()) return;

    const token = localStorage.getItem('thebob-token');
    if (!token) return;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(ORDER_HUB_URL, {
        accessTokenFactory: () => token
      })
      .withAutomaticReconnect()
      .build();

    connection.on('ReceiveOrderUpdate', (receivedOrderId, status) => {
      if (status !== 'Success') return;

      const normalizedOrderId = String(receivedOrderId);

      // Cập nhật row/badge tại chỗ, không cần F5.
      setOrders(prev =>
        prev.map(order =>
          String(order.id) === normalizedOrderId
            ? { ...order, paymentStatus: 'Paid', status: 'Processing' }
            : order
        )
      );

      setSelectedOrder(prev =>
        prev && String(prev.id) === normalizedOrderId
          ? { ...prev, paymentStatus: 'Paid', status: 'Processing' }
          : prev
      );

      playTingTing();
      addNotification(`Don hang #${normalizedOrderId} da thanh toan thanh cong qua SePay.`, 'success');
    });

    connection.on('ReceivePaymentSuccess', (receivedOrderId) => {
      const normalizedOrderId = String(receivedOrderId);

      setOrders(prev =>
        prev.map(order =>
          String(order.id) === normalizedOrderId
            ? { ...order, paymentStatus: 'Paid', status: 'Processing' }
            : order
        )
      );

      setSelectedOrder(prev =>
        prev && String(prev.id) === normalizedOrderId
          ? { ...prev, paymentStatus: 'Paid', status: 'Processing' }
          : prev
      );

      playTingTing();
      addNotification(`Don hang #${normalizedOrderId} da thanh toan thanh cong qua SePay.`, 'success');
    });

    connection.start().catch(error => {
      console.error('SignalR connection failed on AdminOrders:', error);
    });

    connectionRef.current = connection;

    return () => {
      connection.off('ReceiveOrderUpdate');
      connection.off('ReceivePaymentSuccess');
      connection.stop().catch(error => {
        console.error('Error stopping AdminOrders SignalR connection:', error);
      });
      connectionRef.current = null;
    };
  }, [addNotification, isAdmin, playTingTing]);

  const getPaymentState = (order) => {
    if (order.paymentStatus === 'Paid' || order.status === 'Paid') return 'paid';
    if (order.paymentStatus === 'Cancelled' || order.paymentStatus === 'Expired' || order.status === 'Cancelled') return 'cancelled';
    return 'pending';
  };

  const counts = useMemo(() => ({
    all: orders.length,
    pending: orders.filter(order => getPaymentState(order) === 'pending').length,
    paid: orders.filter(order => getPaymentState(order) === 'paid').length,
    cancelled: orders.filter(order => getPaymentState(order) === 'cancelled').length
  }), [orders]);

  const filteredOrders = useMemo(() => {
    if (filter === 'all') return orders;
    return orders.filter(order => getPaymentState(order) === filter);
  }, [filter, orders]);

  const getStatusBadgeClass = (order) => {
    const state = getPaymentState(order);
    if (state === 'paid') return 'status-paid';
    if (state === 'cancelled') return 'status-cancelled';
    return 'status-waiting';
  };

  const getStatusText = (order) => {
    const state = getPaymentState(order);
    if (state === 'paid') return 'Đã thanh toán';
    if (state === 'cancelled') return order.paymentStatus === 'Expired' ? 'Hết hạn' : 'Đã hủy';
    return 'Chờ thanh toán';
  };

  const formatMoney = (value) => `${Number(value || 0).toLocaleString('vi-VN')} VND`;

  if (loading) {
    return <LoadingSkeleton type="table" />;
  }

  return (
    <div className="admin-orders-page">
      <div className="admin-header">
        <div>
          <h1>Quản Lý Đơn Hàng</h1>
          <p>Webhook SePay se tu dong cap nhat trang thai thanh toan theo thoi gian thuc.</p>
        </div>
        <button className="btn-refresh" onClick={fetchOrders}>
          Làm mới dữ liệu
        </button>
      </div>

      <div className="orders-filters">
        {FILTERS.map(item => (
          <button
            key={item.key}
            className={`filter-btn ${filter === item.key ? 'active' : ''}`}
            onClick={() => setFilter(item.key)}
          >
            {item.label} ({counts[item.key]})
          </button>
        ))}
      </div>

      {filteredOrders.length === 0 ? (
        <div className="no-orders">Không có đơn hàng nào</div>
      ) : (
        <div className="orders-table">
          <div className="table-header">
            <span className="col-id">Mã ĐH</span>
            <span className="col-customer">Khách hàng</span>
            <span className="col-date">Ngày đặt</span>
            <span className="col-total">Tổng tiền</span>
            <span className="col-status">Thanh toán</span>
            <span className="col-actions">Thao tác</span>
          </div>

          {filteredOrders.map(order => (
            <div key={order.id} className="table-row">
              <span className="col-id">#{order.id}</span>
              <span className="col-customer">
                <div style={{ fontWeight: 700 }}>{order.customerName || order.customerEmail || 'Không xác định'}</div>
                <div className="payment-method-badge">{order.paymentGateway || order.paymentMethod || 'SePay'}</div>
              </span>
              <span className="col-date">
                {new Date(order.createdAt).toLocaleString('vi-VN')}
              </span>
              <span className="col-total">{formatMoney(order.totalAmount)}</span>
              <span className="col-status">
                <span className={`status-pill ${getStatusBadgeClass(order)}`}>
                  {getStatusText(order)}
                </span>
              </span>
              <span className="col-actions">
                <button className="btn-view" onClick={() => setSelectedOrder(order)}>
                  Xem chi tiết
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {selectedOrder && (
        <div className="admin-modal-backdrop" onClick={() => setSelectedOrder(null)}>
          <div className="admin-order-modal" onClick={event => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Đơn hàng #{selectedOrder.id}</h2>
                <p>{getStatusText(selectedOrder)}</p>
              </div>
              <button className="modal-close" onClick={() => setSelectedOrder(null)}>x</button>
            </div>

            <div className="modal-grid">
              <div className="modal-section">
                <h3>Khách hàng</h3>
                <p><strong>Tên:</strong> {selectedOrder.customerName || 'Không xác định'}</p>
                <p><strong>Điện thoại:</strong> {selectedOrder.customerPhone || 'Chưa có'}</p>
                <p><strong>Email:</strong> {selectedOrder.customerEmail || 'Chưa có'}</p>
                <p><strong>Địa chỉ giao hàng:</strong> {selectedOrder.shippingAddress || 'Chưa có'}</p>
              </div>

              <div className="modal-section">
                <h3>Đối soát</h3>
                <p><strong>Cổng:</strong> {selectedOrder.paymentGateway || selectedOrder.paymentMethod || 'SePay'}</p>
                <p><strong>Mã giao dịch:</strong> {selectedOrder.transactionCode || 'Chưa ghi nhận'}</p>
                <p><strong>VA Number:</strong> {selectedOrder.vaNumber || 'Chua ghi nhan'}</p>
                <p><strong>TransactionId:</strong> {selectedOrder.transactionId || 'Chua ghi nhan'}</p>
                <p><strong>Provider:</strong> {selectedOrder.paymentProvider || selectedOrder.paymentGateway || 'SePay'}</p>
                <p><strong>PaidAt:</strong> {selectedOrder.paidAt ? new Date(selectedOrder.paidAt).toLocaleString('vi-VN') : 'Chua thanh toan'}</p>
                <p><strong>Loi:</strong> {selectedOrder.failureReason || 'Khong co'}</p>
                <p><strong>Tổng tiền:</strong> {formatMoney(selectedOrder.totalAmount)}</p>
                <p><strong>Thời gian:</strong> {new Date(selectedOrder.updatedAt || selectedOrder.createdAt).toLocaleString('vi-VN')}</p>
              </div>
            </div>

            <div className="modal-section">
              <h3>Sản phẩm</h3>
              <div className="modal-items">
                {(selectedOrder.items || []).map(item => (
                  <div className="modal-item" key={item.id}>
                    <div>
                      <strong>{item.productName}</strong>
                      <p>{item.sku} - {item.size} - {item.color}</p>
                    </div>
                    <div>x{item.quantity}</div>
                    <div>{formatMoney(item.price)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
