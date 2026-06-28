import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as signalR from '@microsoft/signalr';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { ordersAPI, ORDER_HUB_URL } from '../api/app';
import { shippingAPI } from '../api/shipping';
import '../styles/AdminOrders.css';
import LoadingSkeleton from '../components/LoadingSkeleton';

// ─── Constants ────────────────────────────────────────────────────────────────

const FILTERS = [
  { key: 'all',       label: 'Tất cả' },
  { key: 'pending',   label: 'Chờ thanh toán' },
  { key: 'paid',      label: 'Đã thanh toán' },
  { key: 'cancelled', label: 'Đã hủy' },
  { key: 'expired',   label: 'Hết hạn' },
];

const PAGE_SIZE = 10;

const EMPTY_COUNTS = { all: 0, pending: 0, paid: 0, cancelled: 0, expired: 0 };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatMoney = (value) =>
  `${Number(value || 0).toLocaleString('vi-VN')} VND`;

/** Derive a simple payment state string from an order object. */
const getPaymentState = (order) => {
  const ps = order.paymentStatus;
  const st = order.status;

  if (ps === 'Paid' || st === 'Paid' || st === 'Processing') return 'paid';
  if (ps === 'Expired')                                        return 'expired';
  if (ps === 'Cancelled' || st === 'Cancelled')                return 'cancelled';
  return 'pending';
};

const STATUS_MAP = {
  paid:      { pill: 'status-paid',      label: 'Đã thanh toán' },
  cancelled: { pill: 'status-cancelled', label: 'Đã hủy' },
  expired:   { pill: 'status-cancelled', label: 'Hết hạn' },
  pending:   { pill: 'status-waiting',   label: 'Chờ thanh toán' },
};

/** Play a two-note "ting-ting" using Web Audio API — no asset required. */
const playTingTing = () => {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;

    const ctx = new Ctx();
    [880, 1320].forEach((freq, i) => {
      const t   = ctx.currentTime + i * 0.16;
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
  } catch (err) {
    console.error('Unable to play admin notification tone:', err);
  }
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusPill({ order }) {
  const state = getPaymentState(order);
  const { pill, label } = STATUS_MAP[state];
  return <span className={`status-pill ${pill}`}>{label}</span>;
}

function OrderModal({ order, onClose, onConfirm, onCancel, actionLoading, onShipmentCreated }) {
  const state = getPaymentState(order);
  const { label } = STATUS_MAP[state];

  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div className="admin-order-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <h2>Đơn hàng #{order.id}</h2>
            <p>{label}</p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Đóng">✕</button>
        </div>

        {/* Customer + Payment grid */}
        <div className="modal-grid">
          <div className="modal-section">
            <h3>Khách hàng</h3>
            <p><strong>Tên:</strong> {order.customerName || 'Không xác định'}</p>
            <p><strong>Điện thoại:</strong> {order.customerPhone || 'Chưa có'}</p>
            <p><strong>Email:</strong> {order.customerEmail || 'Chưa có'}</p>
            <p><strong>Địa chỉ giao hàng:</strong> {order.shippingAddress || 'Chưa có'}</p>
          </div>

          <div className="modal-section">
            <h3>Đối soát thanh toán</h3>
            <p><strong>Cổng:</strong> {order.paymentGateway || order.paymentMethod || 'SePay'}</p>
            <p><strong>Mã giao dịch:</strong> {order.transactionCode || 'Chưa ghi nhận'}</p>
            <p><strong>VA Number:</strong> {order.vaNumber || 'Chưa ghi nhận'}</p>
            <p><strong>Transaction ID:</strong> {order.transactionId || 'Chưa ghi nhận'}</p>
            <p><strong>Provider:</strong> {order.paymentProvider || order.paymentGateway || 'SePay'}</p>
            <p>
              <strong>Thanh toán lúc:</strong>{' '}
              {order.paidAt
                ? new Date(order.paidAt).toLocaleString('vi-VN')
                : 'Chưa thanh toán'}
            </p>
            {order.failureReason && (
              <p><strong>Lỗi:</strong> {order.failureReason}</p>
            )}
            <p><strong>Tổng tiền:</strong> {formatMoney(order.totalAmount)}</p>
            <p>
              <strong>Cập nhật lúc:</strong>{' '}
              {new Date(order.updatedAt || order.createdAt).toLocaleString('vi-VN')}
            </p>
          </div>
        </div>

        {/* Products */}
        <div className="modal-section">
          <h3>Sản phẩm</h3>
          <div className="modal-items">
            {(order.items || []).map((item) => (
              <div className="modal-item" key={item.id}>
                <div>
                  <strong>{item.productName}</strong>
                  <p>{item.sku} — {item.size} — {item.color}</p>
                </div>
                <div>×{item.quantity}</div>
                <div>{formatMoney(item.price)}</div>
              </div>
            ))}
          </div>
        </div>

        {state === 'paid' && (
          <ShippingPanel
            order={order}
            onShipmentCreated={(ghnCode) => onShipmentCreated?.(order.id, ghnCode)}
          />
        )}

        {/* Modal-level action buttons for pending orders */}
        {(state === 'pending' || state === 'expired') && (
          <div className="modal-footer">
            {state === 'pending' && (
              <button
                className="btn-confirm"
                disabled={actionLoading === order.id}
                onClick={() => onConfirm(order.id)}
              >
                {actionLoading === order.id ? 'Đang xử lý…' : 'Xác nhận thanh toán thủ công'}
              </button>
            )}
            <button
              className="btn-cancel"
              disabled={actionLoading === order.id}
              onClick={() => onCancel(order.id)}
            >
              {actionLoading === order.id ? 'Đang xử lý…' : 'Hủy đơn hàng'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Shipping Panel ───────────────────────────────────────────────────────────

export function ShippingPanel({ order, onShipmentCreated }) {
  const [step, setStep]           = useState('idle'); // idle | creating | tracking
  const [tracking, setTracking]   = useState(null);
  const [loadingTrk, setLoadingTrk] = useState(false);
  const [creating, setCreating]   = useState(false);
  const [error, setError]         = useState(null);

  const ghnCode = order.ghnOrderCode; // lưu trong DB, trả về qua API

  // ✅ Fix — thêm loadTracking vào deps array
useEffect(() => {
  if (!ghnCode) return;
  setStep('tracking');
  loadTracking();
}, [ghnCode, loadTracking]); // thêm loadTracking vào đây

  const loadTracking = useCallback(async () => {
    if (!ghnCode) return;
    setLoadingTrk(true);
    try {
      const data = await shippingAPI.getTracking(ghnCode);
      setTracking(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingTrk(false);
    }
  }, [ghnCode]);

  // Tạo đơn vận chuyển với thông tin lấy thẳng từ order
  const handleCreateShipment = async () => {
    if (!window.confirm(`Tạo đơn vận chuyển GHN cho đơn hàng #${order.id}?`)) return;

    setCreating(true);
    setError(null);
    try {
      const result = await shippingAPI.createShipment(order.id, {
        toName:         order.customerName,
        toPhone:        order.customerPhone,
        toAddress:      order.shippingAddress,
        toWardCode:     order.toWardCode,     // cần lưu trong Order khi checkout
        toDistrictId:   order.toDistrictId,   // cần lưu trong Order khi checkout
        weight:         500,                  // gram — điều chỉnh theo sản phẩm
        length:         20,
        width:          15,
        height:         10,
        insuranceValue: order.totalAmount,
        note:           `Đơn hàng #${order.id}`,
        items: (order.items || []).map(item => ({
          name:     item.productName,
          code:     item.id,
          quantity: item.quantity,
          price:    item.price,
          weight:   200,
          length:   10,
          width:    10,
          height:   5
        }))
      });

      onShipmentCreated?.(result.orderCode);
      setStep('tracking');
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleCancelShipment = async () => {
    if (!window.confirm(`Hủy đơn vận chuyển ${ghnCode}?`)) return;
    try {
      await shippingAPI.cancelShipment(order.id, ghnCode);
      onShipmentCreated?.(null); // xóa ghnCode
      setTracking(null);
      setStep('idle');
    } catch (err) {
      setError(err.message);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (step === 'idle') {
    return (
      <div className="shipping-panel">
        <h3>Vận chuyển</h3>
        {error && <p className="shipping-error">{error}</p>}
        <button
          className="btn-confirm"
          onClick={handleCreateShipment}
          disabled={creating}
        >
          {creating ? 'Đang tạo đơn…' : '🚚 Tạo đơn GHN'}
        </button>
      </div>
    );
  }

  return (
    <div className="shipping-panel">
      <div className="shipping-panel-header">
        <h3>Vận chuyển GHN</h3>
        <div className="shipping-code">
          Mã GHN: <strong>{ghnCode}</strong>
        </div>
      </div>

      {error && <p className="shipping-error">{error}</p>}

      {loadingTrk ? (
        <p className="shipping-loading">Đang tải tracking…</p>
      ) : tracking ? (
        <>
          <div className="tracking-status">
            <span className={`status-pill ${getTrackingPill(tracking.status)}`}>
              {tracking.statusName || tracking.status}
            </span>
            {tracking.deliverDate && (
              <span className="tracking-date">
                Giao lúc: {new Date(tracking.deliverDate).toLocaleString('vi-VN')}
              </span>
            )}
          </div>

          <div className="tracking-logs">
            {(tracking.logs || []).map((log, i) => (
              <div key={i} className="tracking-log-item">
                <span className="log-time">
                  {new Date(log.updatedDate).toLocaleString('vi-VN')}
                </span>
                <span className="log-desc">{log.description}</span>
              </div>
            ))}
          </div>

          <div className="shipping-actions">
            <button className="btn-view" onClick={loadTracking}>
              Làm mới
            </button>
            {tracking.status !== 'delivered' && (
              <button className="btn-cancel" onClick={handleCancelShipment}>
                Hủy đơn GHN
              </button>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

// Map GHN status → CSS pill class
function getTrackingPill(status) {
  if (!status) return 'status-waiting';
  const s = status.toLowerCase();
  if (s === 'delivered')                                  return 'status-paid';
  if (s === 'cancel' || s === 'return')                   return 'status-cancelled';
  return 'status-waiting';
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminOrders() {
  const navigate        = useNavigate();
  const { isAdmin }     = useAuth();
  const { addNotification } = useNotification();
  const connectionRef   = useRef(null);

  // List state
  const [orders, setOrders]             = useState([]);
  const [loading, setLoading]           = useState(true);
  const [filter, setFilter]             = useState('all');
  const [search, setSearch]             = useState('');
  const [debouncedSearch, setDebounced] = useState('');
  const [page, setPage]                 = useState(1);
  const [totalItems, setTotalItems]     = useState(0);
  const [totalPages, setTotalPages]     = useState(1);
  const [serverCounts, setServerCounts] = useState(EMPTY_COUNTS);

  // Modal + action state
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [actionLoading, setActionLoading] = useState(null); // orderId being acted on

  // ── Debounce search ─────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [search]);

  // ── Fetch orders ────────────────────────────────────────────────────────────
  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await ordersAPI.getAllOrders({
        search: debouncedSearch,
        status: filter,
        page,
        pageSize: PAGE_SIZE,
      });

      setOrders(res.items ?? []);
      setTotalItems(res.total ?? 0);
      setTotalPages(res.totalPages ?? 1);
      setServerCounts(res.counts ?? EMPTY_COUNTS);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
      addNotification('Lỗi khi tải đơn hàng', 'error');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filter, page, addNotification]);

  useEffect(() => {
    if (!isAdmin()) {
      navigate('/');
      return;
    }
    fetchOrders();
  }, [fetchOrders, isAdmin, navigate]);

  // ── Real-time update helper ──────────────────────────────────────────────────
  const applyRealtimeUpdate = useCallback((rawId) => {
    const id = String(rawId);
    const patch = { paymentStatus: 'Paid', status: 'Processing' };

    setOrders((prev) =>
      prev.map((o) => (String(o.id) === id ? { ...o, ...patch } : o))
    );
    setSelectedOrder((prev) =>
      prev && String(prev.id) === id ? { ...prev, ...patch } : prev
    );

    // Bump the counts: pending-- paid++
    setServerCounts((prev) => ({
      ...prev,
      all:     prev.all,
      pending: Math.max(0, (prev.pending || 0) - 1),
      paid:    (prev.paid || 0) + 1,
    }));

    playTingTing();
    addNotification(`Đơn hàng #${id} đã thanh toán thành công qua SePay.`, 'success');
  }, [addNotification]);

  // ── SignalR ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAdmin()) return;

    const token = localStorage.getItem('thebob-token');
    if (!token) return;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(ORDER_HUB_URL, { accessTokenFactory: () => token })
      .withAutomaticReconnect()
      .build();

    const handleSuccess = (orderId) => applyRealtimeUpdate(orderId);

    // ReceiveOrderUpdate carries (orderId, status); only act on "Success"
    connection.on('ReceiveOrderUpdate', (orderId, status) => {
      if (status === 'Success') handleSuccess(orderId);
    });
    connection.on('ReceivePaymentSuccess', handleSuccess);

    connection.start().catch((err) =>
      console.error('SignalR connection failed (AdminOrders):', err)
    );

    connectionRef.current = connection;

    return () => {
      connection.off('ReceiveOrderUpdate');
      connection.off('ReceivePaymentSuccess');
      connection.stop().catch((err) =>
        console.error('Error stopping AdminOrders SignalR:', err)
      );
      connectionRef.current = null;
    };
  }, [isAdmin, applyRealtimeUpdate]);

  // ── Actions ──────────────────────────────────────────────────────────────────
  const handleConfirmOrder = async (orderId) => {
    if (!window.confirm(`Xác nhận thanh toán thủ công cho đơn hàng #${orderId}?`)) return;

    setActionLoading(orderId);
    try {
      const updated = await ordersAPI.confirmOrder(orderId);

      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
      setSelectedOrder((prev) => (prev?.id === orderId ? updated : prev));

      // Counts: pending-- paid++
      setServerCounts((prev) => ({
        ...prev,
        pending: Math.max(0, (prev.pending || 0) - 1),
        paid:    (prev.paid || 0) + 1,
      }));

      addNotification(`Đã xác nhận thanh toán thủ công cho đơn hàng #${orderId}`, 'success');
    } catch (err) {
      console.error('Failed to confirm order:', err);
      addNotification(err.message || 'Xác nhận thanh toán thất bại', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelOrder = async (orderId) => {
    if (!window.confirm(`Bạn có chắc chắn muốn hủy đơn hàng #${orderId}?`)) return;

    setActionLoading(orderId);
    try {
      const updated = await ordersAPI.cancelAdminOrder(orderId);
      const prevState = getPaymentState(orders.find((o) => o.id === orderId) || {});

      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
      setSelectedOrder((prev) => (prev?.id === orderId ? updated : prev));

      // Counts: whichever bucket it was in-- cancelled++
      setServerCounts((prev) => ({
        ...prev,
        [prevState]: Math.max(0, (prev[prevState] || 0) - 1),
        cancelled:   (prev.cancelled || 0) + 1,
      }));

      addNotification(`Đã hủy đơn hàng #${orderId}`, 'success');
    } catch (err) {
      console.error('Failed to cancel order:', err);
      addNotification(err.message || 'Hủy đơn hàng thất bại', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleShipmentCreated = (orderId, ghnCode) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, ghnOrderCode: ghnCode } : o))
    );
    setSelectedOrder((prev) =>
      prev && prev.id === orderId ? { ...prev, ghnOrderCode: ghnCode } : prev
    );
  };

  // ── Filter change ────────────────────────────────────────────────────────────
  const handleFilterChange = (key) => {
    setFilter(key);
    setPage(1);
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loading) return <LoadingSkeleton type="table" />;

  return (
    <div className="admin-orders-page">
      {/* Page header */}
      <div className="admin-header">
        <div>
          <h1>Quản Lý Đơn Hàng</h1>
          <p className="admin-header-sub">
            Webhook SePay tự động cập nhật trạng thái thanh toán theo thời gian thực.
          </p>
        </div>
        <button className="btn-refresh" onClick={fetchOrders}>
          Làm mới
        </button>
      </div>

      {/* Search */}
      <div className="admin-search-bar">
        <input
          type="text"
          placeholder="Tìm theo mã đơn hàng hoặc tên khách hàng…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
      </div>

      {/* Filter tabs */}
      <div className="orders-filters">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            className={`filter-btn${filter === key ? ' active' : ''}`}
            onClick={() => handleFilterChange(key)}
          >
            {label}
            <span className="filter-count">{serverCounts[key] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* Table or empty */}
      {orders.length === 0 ? (
        <div className="no-orders">
          <p>Không tìm thấy đơn hàng nào.</p>
        </div>
      ) : (
        <>
          <div className="orders-table">
            <div className="table-header">
              <span className="col-id">Mã ĐH</span>
              <span className="col-customer">Khách hàng</span>
              <span className="col-date">Ngày đặt</span>
              <span className="col-total">Tổng tiền</span>
              <span className="col-status">Thanh toán</span>
              <span className="col-actions">Thao tác</span>
            </div>

            {orders.map((order) => {
              const state = getPaymentState(order);
              const busy  = actionLoading === order.id;

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

                  <span className="col-total">{formatMoney(order.totalAmount)}</span>

                  <span className="col-status">
                    <StatusPill order={order} />
                  </span>

                  <span className="col-actions">
                    <button className="btn-view" onClick={() => setSelectedOrder(order)}>
                      Chi tiết
                    </button>

                    {state === 'pending' && (
                      <>
                        <button
                          className="btn-confirm"
                          disabled={busy}
                          onClick={() => handleConfirmOrder(order.id)}
                        >
                          {busy ? '…' : 'Xác nhận TT'}
                        </button>
                        <button
                          className="btn-cancel"
                          disabled={busy}
                          onClick={() => handleCancelOrder(order.id)}
                        >
                          {busy ? '…' : 'Hủy'}
                        </button>
                      </>
                    )}

                    {state === 'expired' && (
                      <button
                        className="btn-cancel"
                        disabled={busy}
                        onClick={() => handleCancelOrder(order.id)}
                      >
                        {busy ? '…' : 'Hủy'}
                      </button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalItems > 0 && (
            <div className="admin-pagination">
              <button
                className="filter-btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← Trước
              </button>
              <span className="pagination-info">
                Trang {page}/{totalPages} — {totalItems} kết quả
              </span>
              <button
                className="filter-btn"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Sau →
              </button>
            </div>
          )}
        </>
      )}

      {/* Detail modal */}
      {selectedOrder && (
        <OrderModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onConfirm={handleConfirmOrder}
          onCancel={handleCancelOrder}
          actionLoading={actionLoading}
          onShipmentCreated={handleShipmentCreated}
        />
      )}
    </div>
  );
}
