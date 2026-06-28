import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as signalR from '@microsoft/signalr';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { ordersAPI, ORDER_HUB_URL } from '../api/app';
import '../styles/AdminOrders.css';
import LoadingSkeleton from '../components/LoadingSkeleton';

// ─── Constants ────────────────────────────────────────────────────────────────

const FILTERS = [
  { key: 'all',        label: 'Tất cả' },
  { key: 'pending',    label: 'Chờ xử lý' },
  { key: 'processing', label: 'Đang xử lý' },
  { key: 'shipped',    label: 'Đang giao' },
  { key: 'delivered',  label: 'Đã giao' },
  { key: 'cancelled',  label: 'Đã hủy' },
];

const STATUS_TO_FILTER = {
  Pending:        'pending',
  PendingPayment: 'pending',
  Processing:     'processing',
  Paid:           'processing',
  Shipped:        'shipped',
  Delivered:      'delivered',
  Cancelled:      'cancelled',
};

const STATUS_LABEL = {
  PendingPayment: 'Chờ thanh toán',
  Pending:        'Chờ xử lý',
  Processing:     'Đang xử lý',
  Paid:           'Đã thanh toán',
  Shipped:        'Đang giao',
  Delivered:      'Đã giao',
  Cancelled:      'Đã hủy',
};

const STATUS_PILL = {
  PendingPayment: 'status-waiting',
  Pending:        'status-waiting',
  Processing:     'status-processing',
  Paid:           'status-processing',
  Shipped:        'status-shipped',
  Delivered:      'status-paid',
  Cancelled:      'status-cancelled',
};

// Hành động tiếp theo theo workflow
const NEXT_ACTION = {
  Processing: { nextStatus: 'Shipped',   label: '🚚 Giao cho shipper', className: 'btn-ship' },
  Shipped:    { nextStatus: 'Delivered', label: '✅ Xác nhận đã giao', className: 'btn-deliver' },
};

const TIMELINE_STEPS = ['PendingPayment', 'Processing', 'Shipped', 'Delivered'];

const fmt = (v) => `${Number(v || 0).toLocaleString('vi-VN')} VNĐ`;

// ─── Sound ────────────────────────────────────────────────────────────────────

const playTingTing = () => {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [880, 1320].forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.16;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.14);
    });
    setTimeout(() => ctx.close?.(), 600);
  } catch (e) {
    console.error('Audio error:', e);
  }
};

// ─── StatusPill ───────────────────────────────────────────────────────────────

function StatusPill({ status }) {
  return (
    <span className={`status-pill ${STATUS_PILL[status] || 'status-waiting'}`}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

// ─── OrderModal ───────────────────────────────────────────────────────────────

function OrderModal({ order, onClose, onUpdateStatus, actionLoading }) {
  const action    = NEXT_ACTION[order.status];
  const canCancel = !['Delivered', 'Cancelled', 'Shipped'].includes(order.status);
  const busy      = actionLoading === order.id;
  const isCancelled = order.status === 'Cancelled';
  const currentIdx  = TIMELINE_STEPS.indexOf(order.status);

  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div className="admin-order-modal" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <div>
            <h2>Đơn hàng #{order.id}</h2>
            <p className="modal-order-number">{order.orderNumber}</p>
          </div>
          <div className="modal-header-right">
            <StatusPill status={order.status} />
            <button type="button" className="modal-close" onClick={onClose} aria-label="Đóng">✕</button>
          </div>
        </div>

        {/* Timeline */}
        <div className="modal-timeline">
          {TIMELINE_STEPS.map((s, i) => {
            const done    = !isCancelled && i < currentIdx;
            const current = !isCancelled && i === currentIdx;
            return (
              <div key={s} className={`timeline-step${done ? ' done' : ''}${current ? ' current' : ''}${isCancelled ? ' cancelled' : ''}`}>
                <div className="timeline-dot" />
                <span className="timeline-label">{STATUS_LABEL[s]}</span>
                {i < TIMELINE_STEPS.length - 1 && <div className="timeline-line" />}
              </div>
            );
          })}
          {isCancelled && (
            <div className="timeline-step cancelled current">
              <div className="timeline-dot" />
              <span className="timeline-label">Đã hủy</span>
            </div>
          )}
        </div>

        {/* Info grid */}
        <div className="modal-grid">
          <div className="modal-section">
            <h3>Khách hàng</h3>
            <p><strong>Tên:</strong> {order.customerName || 'Không xác định'}</p>
            <p><strong>Điện thoại:</strong> {order.customerPhone || 'Chưa có'}</p>
            <p><strong>Email:</strong> {order.customerEmail || 'Chưa có'}</p>
            <p><strong>Địa chỉ:</strong> {order.shippingAddress || 'Chưa có'}</p>
            <p><strong>Thanh toán:</strong> {order.paymentMethod || 'Chưa có'}</p>
          </div>

          <div className="modal-section">
            <h3>Đối soát thanh toán</h3>
            <p><strong>Cổng:</strong> {order.paymentGateway || order.paymentMethod || 'SePay'}</p>
            <p><strong>Mã giao dịch:</strong> {order.transactionCode || 'Chưa ghi nhận'}</p>
            <p><strong>VA Number:</strong> {order.vaNumber || 'Chưa ghi nhận'}</p>
            <p><strong>Transaction ID:</strong> {order.transactionId || 'Chưa ghi nhận'}</p>
            <p><strong>Provider:</strong> {order.paymentProvider || 'SePay'}</p>
            <p><strong>Thanh toán lúc:</strong> {order.paidAt ? new Date(order.paidAt).toLocaleString('vi-VN') : 'Chưa thanh toán'}</p>
            {order.failureReason && <p><strong>Lỗi:</strong> {order.failureReason}</p>}
            <p><strong>Cập nhật:</strong> {new Date(order.updatedAt || order.createdAt).toLocaleString('vi-VN')}</p>
          </div>
        </div>

        {/* Products */}
        <div className="modal-section modal-section-padded">
          <h3>Sản phẩm</h3>
          <div className="modal-items">
            {(order.items || []).map((item) => (
              <div className="modal-item" key={item.id}>
                <div>
                  <strong>{item.productName}</strong>
                  <p>{item.sku} — {item.size} — {item.color}</p>
                </div>
                <div>×{item.quantity}</div>
                <div>{fmt(item.price)}</div>
              </div>
            ))}
          </div>
          <div className="modal-total-row">
            <span>Tổng cộng</span>
            <strong>{fmt(order.totalAmount)}</strong>
          </div>
        </div>

        {/* Footer */}
        {(action || canCancel) && (
          <div className="modal-footer">
            {action && (
              <button
                type="button"
                className={action.className}
                disabled={busy}
                onClick={() => onUpdateStatus(order.id, action.nextStatus)}
              >
                {busy ? 'Đang xử lý…' : action.label}
              </button>
            )}
            {canCancel && (
              <button
                type="button"
                className="btn-cancel"
                disabled={busy}
                onClick={() => onUpdateStatus(order.id, 'Cancelled')}
              >
                {busy ? 'Đang xử lý…' : 'Hủy đơn hàng'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AdminOrders() {
  const navigate            = useNavigate();
  const { isAdmin }         = useAuth();
  const { addNotification } = useNotification();
  const connectionRef       = useRef(null);

  const [orders,        setOrders]        = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [filter,        setFilter]        = useState('all');
  const [search,        setSearch]        = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const data = await ordersAPI.getAllOrders();
      data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setOrders(data);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
      addNotification('Lỗi khi tải đơn hàng', 'error');
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => {
    if (!isAdmin()) { navigate('/'); return; }
    fetchOrders();
  }, [fetchOrders, isAdmin, navigate]);

  // ── SignalR ────────────────────────────────────────────────────────────────

  const applyRealtimeUpdate = useCallback((rawId) => {
    const id    = String(rawId);
    const patch = { paymentStatus: 'Paid', status: 'Processing' };
    setOrders(prev => prev.map(o => String(o.id) === id ? { ...o, ...patch } : o));
    setSelectedOrder(prev => prev && String(prev.id) === id ? { ...prev, ...patch } : prev);
    playTingTing();
    addNotification(`Đơn hàng #${id} đã thanh toán thành công qua SePay.`, 'success');
  }, [addNotification]);

  useEffect(() => {
    if (!isAdmin()) return;
    const token = localStorage.getItem('thebob-token');
    if (!token) return;

    const conn = new signalR.HubConnectionBuilder()
      .withUrl(ORDER_HUB_URL, { accessTokenFactory: () => token })
      .withAutomaticReconnect()
      .build();

    conn.on('ReceiveOrderUpdate',    (id, status) => { if (status === 'Success') applyRealtimeUpdate(id); });
    conn.on('ReceivePaymentSuccess', applyRealtimeUpdate);
    conn.on('ReceiveStatusUpdate',   (id, status) => {
      const sid = String(id);
      setOrders(prev => prev.map(o => String(o.id) === sid ? { ...o, status } : o));
      setSelectedOrder(prev => prev && String(prev.id) === sid ? { ...prev, status } : prev);
    });

    conn.start().catch(err => console.error('SignalR failed:', err));
    connectionRef.current = conn;

    return () => {
      conn.off('ReceiveOrderUpdate');
      conn.off('ReceivePaymentSuccess');
      conn.off('ReceiveStatusUpdate');
      conn.stop().catch(() => {});
      connectionRef.current = null;
    };
  }, [isAdmin, applyRealtimeUpdate]);

  // ── Search + Filter (frontend) ─────────────────────────────────────────────

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter(order => {
      if (filter !== 'all') {
        const bucket = STATUS_TO_FILTER[order.status] || 'cancelled';
        if (bucket !== filter) return false;
      }
      if (q) {
        const haystack = [
          String(order.id),
          order.orderNumber   || '',
          order.customerName  || '',
          order.customerEmail || '',
          order.customerPhone || '',
        ].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [orders, filter, search]);

  const counts = useMemo(() => {
    const c = { all: orders.length, pending: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0 };
    orders.forEach(o => {
      const b = STATUS_TO_FILTER[o.status] || 'cancelled';
      if (c[b] !== undefined) c[b]++;
    });
    return c;
  }, [orders]);

  // ── Update status ──────────────────────────────────────────────────────────

  const handleUpdateStatus = useCallback(async (orderId, newStatus) => {
    const confirmMsg = {
      Shipped:   `Xác nhận đã giao đơn hàng #${orderId} cho shipper?`,
      Delivered: `Xác nhận đơn hàng #${orderId} đã giao thành công đến khách?`,
      Cancelled: `Bạn có chắc muốn hủy đơn hàng #${orderId}?`,
    };
    if (!window.confirm(confirmMsg[newStatus] || `Cập nhật đơn hàng #${orderId}?`)) return;

    setActionLoading(orderId);
    try {
      const updated = await ordersAPI.updateOrderStatus(orderId, newStatus);
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updated } : o));
      setSelectedOrder(prev => prev?.id === orderId ? { ...prev, ...updated } : prev);

      const successMsg = {
        Shipped:   `Đơn hàng #${orderId} đã được giao cho shipper.`,
        Delivered: `Đơn hàng #${orderId} đã giao thành công đến khách.`,
        Cancelled: `Đã hủy đơn hàng #${orderId}.`,
      };
      addNotification(successMsg[newStatus] || `Đã cập nhật đơn hàng #${orderId}.`, 'success');
    } catch (err) {
      console.error('Update status failed:', err);
      addNotification(err.message || 'Cập nhật trạng thái thất bại', 'error');
    } finally {
      setActionLoading(null);
    }
  }, [addNotification]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <LoadingSkeleton type="table" />;

  return (
    <div className="admin-orders-page">

      <div className="admin-header">
        <div>
          <h1>Quản Lý Đơn Hàng</h1>
          <p className="admin-header-sub">
            SePay tự động cập nhật trạng thái thanh toán theo thời gian thực.
          </p>
        </div>
        <button type="button" className="btn-refresh" onClick={fetchOrders}>
          Làm mới
        </button>
      </div>

      <div className="admin-search-bar">
        <input
          type="text"
          className="search-input"
          placeholder="Tìm theo mã đơn, tên khách, email, số điện thoại…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="orders-filters">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={`filter-btn${filter === key ? ' active' : ''}`}
            onClick={() => setFilter(key)}
          >
            {label}
            <span className="filter-count">{counts[key] ?? 0}</span>
          </button>
        ))}
      </div>

      {filteredOrders.length === 0 ? (
        <div className="no-orders">
          <p>{search ? `Không tìm thấy kết quả cho "${search}"` : 'Không có đơn hàng nào.'}</p>
        </div>
      ) : (
        <div className="orders-table">
          <div className="table-header">
            <span className="col-id">Mã ĐH</span>
            <span className="col-customer">Khách hàng</span>
            <span className="col-date">Ngày đặt</span>
            <span className="col-total">Tổng tiền</span>
            <span className="col-status">Trạng thái</span>
            <span className="col-actions">Thao tác</span>
          </div>

          {filteredOrders.map(order => {
            const busy   = actionLoading === order.id;
            const action = NEXT_ACTION[order.status];

            return (
              <div key={order.id} className="table-row">
                <span className="col-id">#{order.id}</span>

                <span className="col-customer">
                  <div className="customer-name">
                    {order.customerName || order.customerEmail || 'Không xác định'}
                  </div>
                  <div className="payment-method-badge">
                    {order.paymentGateway || order.paymentMethod || 'SePay'}
                  </div>
                </span>

                <span className="col-date">
                  {new Date(order.createdAt).toLocaleString('vi-VN')}
                </span>

                <span className="col-total">{fmt(order.totalAmount)}</span>

                <span className="col-status">
                  <StatusPill status={order.status} />
                </span>

                <span className="col-actions">
                  <button
                    type="button"
                    className="btn-view"
                    onClick={() => setSelectedOrder(order)}
                  >
                    Chi tiết
                  </button>

                  {action && (
                    <button
                      type="button"
                      className={action.className}
                      disabled={busy}
                      onClick={() => handleUpdateStatus(order.id, action.nextStatus)}
                    >
                      {busy ? '…' : action.label}
                    </button>
                  )}

                  {!['Delivered', 'Cancelled', 'Shipped'].includes(order.status) && (
                    <button
                      type="button"
                      className="btn-cancel"
                      disabled={busy}
                      onClick={() => handleUpdateStatus(order.id, 'Cancelled')}
                    >
                      {busy ? '…' : 'Hủy'}
                    </button>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {selectedOrder && (
        <OrderModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdateStatus={handleUpdateStatus}
          actionLoading={actionLoading}
        />
      )}
    </div>
  );
}
