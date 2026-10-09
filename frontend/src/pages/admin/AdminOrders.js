import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as signalR from '@microsoft/signalr';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { usePreferences } from '../../context/PreferencesContext';
import { ordersAPI, ORDER_HUB_URL, shippingAPI } from '../../api/app';
import { Icons } from '../../components/icons';
import '../../styles/AdminOrders.css';
import LoadingSkeleton from '../../components/LoadingSkeleton';

// ─── Constants ────────────────────────────────────────────────────────────────

const RefreshIcon = Icons.refresh;
const SearchIcon = Icons.search;
const CloseIcon = Icons.close;
const TruckIcon = Icons.truck;
const CheckIcon = Icons.circleCheck;
const CashIcon = Icons.cash;
const UserIcon = Icons.user;
const CalendarIcon = Icons.calendar;
const ProductIcon = Icons.product;
const DetailsIcon = Icons.orders;

const FILTERS = [
  { key: 'all',        labelKey: 'admin.orders.filter.all', Icon: DetailsIcon },
  { key: 'pending',    labelKey: 'admin.orders.filter.pending', Icon: CashIcon },
  { key: 'processing', labelKey: 'admin.orders.filter.processing', Icon: ProductIcon },
  { key: 'shipped',    labelKey: 'admin.orders.filter.shipped', Icon: TruckIcon },
  { key: 'delivered',  labelKey: 'admin.orders.filter.delivered', Icon: CheckIcon },
  { key: 'cancelled',  labelKey: 'admin.orders.filter.cancelled', Icon: CloseIcon },
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
  PendingPayment: 'admin.orders.status.pendingPayment',
  Pending:        'admin.orders.status.pending',
  Processing:     'admin.orders.status.processing',
  Paid:           'admin.orders.status.paid',
  Shipped:        'admin.orders.status.shipped',
  Delivered:      'admin.orders.status.delivered',
  Cancelled:      'admin.orders.status.cancelled',
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

const PAYMENT_METHOD_LABEL = {
  cod: 'admin.orders.payment.cod',
  bank_transfer: 'admin.orders.payment.bank_transfer',
  qr: 'admin.orders.payment.qr',
};

const SHIPPING_STATUS_LABEL = {
  ready_to_pick: 'admin.orders.shipping.readyToPick',
  picking: 'admin.orders.shipping.picking',
  money_collect_picking: 'admin.orders.shipping.collectingFromSender',
  picked: 'admin.orders.shipping.picked',
  storing: 'admin.orders.shipping.storing',
  transporting: 'admin.orders.shipping.transporting',
  sorting: 'admin.orders.shipping.sorting',
  delivering: 'admin.orders.shipping.delivering',
  money_collect_delivering: 'admin.orders.shipping.collectingCod',
  delivered: 'admin.orders.shipping.delivered',
  delivery_fail: 'admin.orders.shipping.deliveryFailed',
  waiting_to_return: 'admin.orders.shipping.waitingToReturn',
  return: 'admin.orders.shipping.return',
  return_transporting: 'admin.orders.shipping.returnTransporting',
  return_sorting: 'admin.orders.shipping.returnSorting',
  returning: 'admin.orders.shipping.returning',
  return_fail: 'admin.orders.shipping.returnFailed',
  returned: 'admin.orders.shipping.returned',
  cancel: 'admin.orders.shipping.cancelled',
};

// Hành động tiếp theo theo workflow
const TIMELINE_STEPS = ['PendingPayment', 'Processing', 'Shipped', 'Delivered'];

const LOCALE_TAGS = { vi: 'vi-VN', en: 'en-US', zh: 'zh-CN' };
const formatMoney = (value, locale) => `${Number(value || 0).toLocaleString(LOCALE_TAGS[locale])} VNĐ`;
const getShippingStatusLabel = (status, t) => (
  SHIPPING_STATUS_LABEL[String(status || '').toLowerCase()]
    ? t(SHIPPING_STATUS_LABEL[String(status || '').toLowerCase()])
    : status || t('admin.orders.shippingNoData')
);

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

function StatusPill({ status, t }) {
  const StatusIcon = {
    PendingPayment: CashIcon,
    Pending: CashIcon,
    Processing: ProductIcon,
    Paid: CheckIcon,
    Shipped: TruckIcon,
    Delivered: CheckIcon,
    Cancelled: CloseIcon,
  }[status] || DetailsIcon;

  return (
    <span className={`status-pill ${STATUS_PILL[status] || 'status-waiting'}`}>
      <StatusIcon size={14} />
      {STATUS_LABEL[status] ? t(STATUS_LABEL[status]) : status}
    </span>
  );
}

// ─── OrderModal ───────────────────────────────────────────────────────────────

function OrderModal({
  order,
  tracking,
  trackingLoading,
  onClose,
  onUpdateStatus,
  onConfirmPayment,
  onCreateShipment,
  onSetGhnCode,
  onRefreshTracking,
  onCancelShipment,
  actionLoading,
  t,
  locale,
}) {
  const [manualCode, setManualCode] = useState('');
  const [showManualCode, setShowManualCode] = useState(false);
  const busy      = actionLoading === order.id;
  const isCancelled = order.status === 'Cancelled';
  const currentIdx  = TIMELINE_STEPS.indexOf(order.status);
  const hasShipment = Boolean(order.ghnOrderCode);
  const canCancel = !hasShipment && !['Delivered', 'Cancelled', 'Shipped'].includes(order.status);
  const canCancelShipment = hasShipment && order.status === 'Shipped';
  const handleManualCodeSubmit = async (event) => {
    event.preventDefault();
    const success = await onSetGhnCode(order.id, manualCode.trim());
    if (success) {
      setManualCode('');
      setShowManualCode(false);
    }
  };

  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div className="admin-order-modal" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <div>
            <h2>{t('admin.orders.modal.order', { id: order.id })}</h2>
            <p className="modal-order-number">{order.orderNumber}</p>
          </div>
          <div className="modal-header-right">
            <StatusPill status={order.status} t={t} />
            <button type="button" className="modal-close" onClick={onClose} aria-label={t('admin.orders.modal.close')}>
              <CloseIcon size={18} />
            </button>
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
                <span className="timeline-label">{t(STATUS_LABEL[s])}</span>
                {i < TIMELINE_STEPS.length - 1 && <div className="timeline-line" />}
              </div>
            );
          })}
          {isCancelled && (
            <div className="timeline-step cancelled current">
              <div className="timeline-dot" />
              <span className="timeline-label">{t('admin.orders.modal.cancelled')}</span>
            </div>
          )}
        </div>

        {/* Info grid */}
        <div className="modal-grid">
          <div className="modal-section">
            <h3><UserIcon size={16} /> {t('admin.orders.modal.customer')}</h3>
            <p><strong>{t('admin.orders.modal.name')}</strong> {order.customerName || t('admin.orders.unknown')}</p>
            <p><strong>{t('admin.orders.modal.phone')}</strong> {order.customerPhone || t('admin.orders.shippingNoData')}</p>
            <p><strong>{t('admin.orders.modal.email')}</strong> {order.customerEmail || t('admin.orders.shippingNoData')}</p>
            <p><strong>{t('admin.orders.modal.address')}</strong> {order.shippingAddress || t('admin.orders.shippingNoData')}</p>
            <p><strong>{t('admin.orders.modal.payment')}</strong> {PAYMENT_METHOD_LABEL[order.paymentMethod] ? t(PAYMENT_METHOD_LABEL[order.paymentMethod]) : order.paymentMethod || t('admin.orders.shippingNoData')}</p>
          </div>

          <div className="modal-section">
            <h3><TruckIcon size={16} /> {t('admin.orders.modal.ghn')}</h3>
            <p><strong>{t('admin.orders.modal.trackingCode')}</strong> <span className="ghn-code">{order.ghnOrderCode || t('admin.orders.modal.notCreated')}</span></p>
            <p><strong>{t('admin.orders.modal.shippingStatus')}</strong> {tracking?.statusName || getShippingStatusLabel(tracking?.status || order.shippingStatus, t)}</p>
            {tracking?.deliverDate && <p><strong>{t('admin.orders.modal.deliveryDate')}</strong> {new Date(tracking.deliverDate).toLocaleString(LOCALE_TAGS[locale])}</p>}
            {order.status === 'Processing' && !order.ghnOrderCode && (
              <div className="ghn-actions">
                <button type="button" className="btn-ship" disabled={busy} onClick={() => onCreateShipment(order.id)}>
                  {busy ? t('admin.orders.processing') : <><TruckIcon size={16} /> {t('admin.orders.modal.createShipment')}</>}
                </button>
                <button type="button" className="btn-view" onClick={() => setShowManualCode(value => !value)}>
                  {showManualCode ? <CloseIcon size={15} /> : <DetailsIcon size={15} />}
                  {showManualCode ? t('admin.orders.modal.closeInput') : t('admin.orders.modal.attachCode')}
                </button>
              </div>
            )}
            {showManualCode && order.status === 'Processing' && !hasShipment && (
              <form className="ghn-manual-form" onSubmit={handleManualCodeSubmit}>
                <label htmlFor={`ghn-code-${order.id}`}>{t('admin.orders.modal.ghnCodeLabel')}</label>
                <input
                  id={`ghn-code-${order.id}`}
                  value={manualCode}
                  onChange={event => setManualCode(event.target.value)}
                  placeholder={t('admin.orders.ghnCodePlaceholder')}
                  autoComplete="off"
                  required
                />
                <p>{t('admin.orders.modal.ghnCodeNote')}</p>
                <button type="submit" className="btn-ship" disabled={busy || !manualCode.trim()}>
                  {busy ? t('admin.orders.verifying') : <><CheckIcon size={15} /> {t('admin.orders.modal.verifyLink')}</>}
                </button>
              </form>
            )}
            {hasShipment && (
              <>
                <div className="ghn-actions">
                  <button type="button" className="btn-view" disabled={trackingLoading} onClick={() => onRefreshTracking(order.id)}>
                    <RefreshIcon size={15} />
                    {trackingLoading ? t('admin.orders.syncing') : t('admin.orders.modal.syncGhn')}
                  </button>
                  {canCancelShipment && (
                    <button type="button" className="btn-cancel" disabled={busy} onClick={() => onCancelShipment(order.id, order.ghnOrderCode)}>
                      {busy ? t('admin.orders.processing') : <><CloseIcon size={15} /> {t('admin.orders.modal.cancelShipment')}</>}
                    </button>
                  )}
                </div>
              </>
            )}
            {tracking?.logs?.length > 0 && (
              <div className="ghn-tracking-history">
                <h4>{t('admin.orders.modal.trackingHistory')}</h4>
                {tracking.logs.map((log, index) => (
                  <div className="ghn-tracking-event" key={`${log.updatedDate || log.status}-${index}`}>
                    <span className="ghn-tracking-marker" />
                    <div>
                      <strong>{log.statusName || log.description || getShippingStatusLabel(log.status, t)}</strong>
                      {log.description && log.description !== log.statusName && <p>{log.description}</p>}
                      {log.updatedDate && <time>{new Date(log.updatedDate).toLocaleString(LOCALE_TAGS[locale])}</time>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="modal-section">
            <h3><CashIcon size={16} /> {t('admin.orders.modal.reconciliation')}</h3>
            <p><strong>{t('admin.orders.modal.gateway')}</strong> {PAYMENT_METHOD_LABEL[order.paymentMethod] ? t(PAYMENT_METHOD_LABEL[order.paymentMethod]) : order.paymentGateway || order.paymentMethod || 'SePay'}</p>
            <p><strong>{t('admin.orders.modal.transactionCode')}</strong> {order.transactionCode || t('admin.orders.modal.notRecorded')}</p>
            <p><strong>{t('admin.orders.modal.vaNumber')}</strong> {order.vaNumber || t('admin.orders.modal.notRecorded')}</p>
            <p><strong>{t('admin.orders.modal.transactionId')}</strong> {order.transactionId || t('admin.orders.modal.notRecorded')}</p>
            <p><strong>{t('admin.orders.modal.provider')}</strong> {order.paymentProvider || 'SePay'}</p>
            <p><strong>{t('admin.orders.modal.paidAt')}</strong> {order.paidAt ? new Date(order.paidAt).toLocaleString(LOCALE_TAGS[locale]) : t('admin.orders.modal.notPaid')}</p>
            {order.failureReason && <p><strong>{t('admin.orders.modal.failureReason')}</strong> {order.failureReason}</p>}
            <p><strong>{t('admin.orders.modal.updatedAt')}</strong> {new Date(order.updatedAt || order.createdAt).toLocaleString(LOCALE_TAGS[locale])}</p>
          </div>
        </div>

        {/* Products */}
        <div className="modal-section modal-section-padded">
          <h3><ProductIcon size={16} /> {t('admin.orders.modal.products')}</h3>
          <div className="modal-items">
            {(order.items || []).map((item) => (
              <div className="modal-item" key={item.id}>
                <div>
                  <strong>{item.productName}</strong>
                  <p>{item.sku} — {item.size} — {item.color}</p>
                </div>
                <div>×{item.quantity}</div>
                <div>{formatMoney(item.price, locale)}</div>
              </div>
            ))}
          </div>
          <div className="modal-total-row">
            <span>{t('admin.orders.modal.total')}</span>
            <strong>{formatMoney(order.totalAmount, locale)}</strong>
          </div>
        </div>

        {/* Footer */}
        {(canCancel || order.status === 'PendingPayment') && (
          <div className="modal-footer">
            {order.status === 'PendingPayment' && (
              <button
                type="button"
                className="btn-ship"
                disabled={busy}
                onClick={() => onConfirmPayment(order.id)}
              >
                {busy ? t('admin.orders.processing') : <><CheckIcon size={16} /> {t('admin.orders.modal.confirmPayment')}</>}
              </button>
            )}
            {canCancel && (
              <button
                type="button"
                className="btn-cancel"
                disabled={busy}
                onClick={() => onUpdateStatus(order.id, 'Cancelled')}
              >
                {busy ? t('admin.orders.processing') : <><CloseIcon size={16} /> {t('admin.orders.modal.cancelOrder')}</>}
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
  const { t, locale }       = usePreferences();
  const connectionRef       = useRef(null);

  const [orders,        setOrders]        = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [filter,        setFilter]        = useState('all');
  const [search,        setSearch]        = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [trackingData, setTrackingData] = useState({});
  const [trackingLoading, setTrackingLoading] = useState(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchOrders = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const data = await ordersAPI.getAllOrders();
      data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setOrders(data);
      setSelectedOrder(current => current
        ? data.find(order => order.id === current.id) || current
        : current);
      return data;
    } catch (err) {
      console.error('Failed to fetch orders:', err);
      addNotification(t('admin.orders.notification.loadError'), 'error');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [addNotification, t]);

  useEffect(() => {
    if (!isAdmin()) { navigate('/'); return; }
    fetchOrders();
  }, [fetchOrders, isAdmin, navigate]);

  // ── SignalR ────────────────────────────────────────────────────────────────

  const applyRealtimeUpdate = useCallback((rawId) => {
    const id = String(rawId);
    fetchOrders(false).catch(() => {});
    playTingTing();
    addNotification(t('admin.orders.notification.paymentSuccess', { id }), 'success');
  }, [addNotification, fetchOrders, t]);

  useEffect(() => {
    if (!isAdmin()) return;
    const token = localStorage.getItem('thebob-token');
    if (!token) return;

    const conn = new signalR.HubConnectionBuilder()
      .withUrl(ORDER_HUB_URL, { accessTokenFactory: () => token })
      .withAutomaticReconnect()
      .build();

    conn.on('ReceiveOrderUpdate',    (id, status) => { if (status === 'Success') applyRealtimeUpdate(id); });
    conn.on('ReceiveNewOrder', () => {
      fetchOrders(false).catch(() => {});
    });
    conn.on('ReceivePaymentSuccess', applyRealtimeUpdate);
    conn.on('ReceiveStatusUpdate',   () => {
      fetchOrders(false).catch(() => {});
    });

    conn.start().catch(err => console.error('SignalR failed:', err));
    connectionRef.current = conn;

    return () => {
      conn.off('ReceiveOrderUpdate');
      conn.off('ReceiveNewOrder');
      conn.off('ReceivePaymentSuccess');
      conn.off('ReceiveStatusUpdate');
      conn.stop().catch(() => {});
      connectionRef.current = null;
    };
  }, [isAdmin, applyRealtimeUpdate, fetchOrders]);

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
          order.ghnOrderCode  || '',
          getShippingStatusLabel(order.shippingStatus, t),
        ].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [orders, filter, search, t]);

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
    if (newStatus !== 'Cancelled') {
      addNotification(t('admin.orders.notification.manualSyncOnly'), 'error');
      return;
    }

    const confirmMsg = newStatus === 'Cancelled'
      ? t('admin.orders.confirm.cancel', { id: orderId })
      : t('admin.orders.confirm.update', { id: orderId });
    if (!window.confirm(confirmMsg)) return;

    setActionLoading(orderId);
    try {
      const updated = await ordersAPI.updateOrderStatus(orderId, newStatus);
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updated } : o));
      setSelectedOrder(prev => prev?.id === orderId ? { ...prev, ...updated } : prev);

      const successMsg = newStatus === 'Cancelled'
        ? t('admin.orders.notification.cancelled', { id: orderId })
        : t('admin.orders.notification.updated', { id: orderId });
      addNotification(successMsg, 'success');
    } catch (err) {
      console.error('Update status failed:', err);
      addNotification(err.message || t('admin.orders.notification.updateError'), 'error');
    } finally {
      setActionLoading(null);
    }
  }, [addNotification, t]);

  const handleConfirmPayment = useCallback(async (orderId) => {
    if (!window.confirm(t('admin.orders.confirm.payment', { id: orderId }))) return;

    setActionLoading(orderId);
    try {
      const updated = await ordersAPI.confirmOrderManual(orderId);
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updated } : o));
      setSelectedOrder(prev => prev?.id === orderId ? { ...prev, ...updated } : prev);
      addNotification(t('admin.orders.notification.paymentConfirmed', { id: orderId }), 'success');
    } catch (err) {
      console.error('Confirm payment manual failed:', err);
      addNotification(err.message || t('admin.orders.notification.paymentError'), 'error');
    } finally {
      setActionLoading(null);
    }
  }, [addNotification, t]);

  const handleCreateShipment = useCallback(async (orderId) => {
    if (!window.confirm(t('admin.orders.confirm.createShipment', { id: orderId }))) return;

    setActionLoading(orderId);
    try {
      const result = await shippingAPI.createShipment(orderId, null);
      addNotification(t('admin.orders.notification.shipmentCreated'), 'success');
      setTrackingData(current => {
        const next = { ...current };
        delete next[orderId];
        return next;
      });
      
      setOrders(prev => prev.map(o => o.id === orderId ? { 
        ...o, 
        ghnOrderCode: result.ghnOrderCode, 
        shippingStatus: result.shippingStatus,
        status: result.orderStatus 
      } : o));
      
      setSelectedOrder(prev => prev?.id === orderId ? { 
        ...prev, 
        ghnOrderCode: result.ghnOrderCode, 
        shippingStatus: result.shippingStatus,
        status: result.orderStatus 
      } : prev);
    } catch (err) {
      console.error('Create shipment failed:', err);
      addNotification(err.message || t('admin.orders.notification.shipmentError'), 'error');
    } finally {
      setActionLoading(null);
    }
  }, [addNotification, t]);

  const handleSetGhnCode = useCallback(async (orderId, ghnOrderCode) => {
    if (!window.confirm(t('admin.orders.confirm.linkShipment', { id: orderId }))) return false;

    setActionLoading(orderId);
    try {
      const result = await shippingAPI.setGhnCode(orderId, ghnOrderCode);
      const updated = {
        ghnOrderCode: result.ghnOrderCode,
        shippingStatus: result.shippingStatus,
        status: result.orderStatus,
      };
      setOrders(prev => prev.map(order => order.id === orderId ? { ...order, ...updated } : order));
      setSelectedOrder(prev => prev?.id === orderId ? { ...prev, ...updated } : prev);
      if (result.tracking) {
        setTrackingData(prev => ({ ...prev, [orderId]: result.tracking }));
      }
      addNotification(t('admin.orders.notification.shipmentLinked', { id: orderId }), 'success');
      return true;
    } catch (err) {
      console.error('Set GHN code failed:', err);
      addNotification(err.message || t('admin.orders.notification.shipmentLinkError'), 'error');
      return false;
    } finally {
      setActionLoading(null);
    }
  }, [addNotification, t]);

  const handleRefreshTracking = useCallback(async (orderId) => {
    setTrackingLoading(orderId);
    try {
      const result = await shippingAPI.refreshOrderTracking(orderId);
      const updated = {
        ghnOrderCode: result.ghnOrderCode,
        shippingStatus: result.shippingStatus,
        status: result.orderStatus,
      };
      setTrackingData(prev => ({ ...prev, [orderId]: result.tracking }));
      setOrders(prev => prev.map(order => order.id === orderId ? { ...order, ...updated } : order));
      setSelectedOrder(prev => prev?.id === orderId ? { ...prev, ...updated } : prev);
      addNotification(t('admin.orders.notification.trackingSynced'), 'success');
    } catch (err) {
      console.error('Refresh GHN tracking failed:', err);
      addNotification(err.message || t('admin.orders.notification.trackingError'), 'error');
    } finally {
      setTrackingLoading(null);
    }
  }, [addNotification, t]);

  const handleCancelShipment = useCallback(async (orderId, ghnOrderCode) => {
    if (!window.confirm(t('admin.orders.confirm.cancelShipment', { code: ghnOrderCode }))) return;

    setActionLoading(orderId);
    try {
      await shippingAPI.cancelShipment(orderId, ghnOrderCode);
      addNotification(t('admin.orders.notification.shipmentCancelled'), 'success');
      
      setOrders(prev => prev.map(o => o.id === orderId ? { 
        ...o, 
        ghnOrderCode: null, 
        shippingStatus: 'cancel',
        status: 'Processing' 
      } : o));
      
      setSelectedOrder(prev => prev?.id === orderId ? { 
        ...prev, 
        ghnOrderCode: null, 
        shippingStatus: 'cancel',
        status: 'Processing' 
      } : prev);
      setTrackingData(current => {
        const next = { ...current };
        delete next[orderId];
        return next;
      });
    } catch (err) {
      console.error('Cancel shipment failed:', err);
      addNotification(err.message || t('admin.orders.notification.shipmentCancelError'), 'error');
    } finally {
      setActionLoading(null);
    }
  }, [addNotification, t]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <LoadingSkeleton type="table" />;

  return (
    <div className="admin-orders-page">

      <div className="admin-header">
        <div>
          <span className="orders-eyebrow">{t('admin.orders.eyebrow')}</span>
          <h1>{t('admin.orders.title')}</h1>
          <p className="admin-header-sub">
            {t('admin.orders.subtitle')}
          </p>
        </div>
        <button type="button" className="btn-refresh" onClick={fetchOrders}>
          <RefreshIcon size={17} />
          {t('admin.orders.refresh')}
        </button>
      </div>

      <div className="admin-search-bar">
        <SearchIcon className="orders-search-icon" size={19} />
        <input
          type="text"
          className="search-input"
          placeholder={t('admin.orders.searchPlaceholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button type="button" className="orders-search-clear" onClick={() => setSearch('')} aria-label={t('admin.orders.clearSearch')}>
            <CloseIcon size={16} />
          </button>
        )}
      </div>

      <div className="orders-filters">
        {FILTERS.map(({ key, labelKey, Icon }) => (
          <button
            key={key}
            type="button"
            className={`filter-btn${filter === key ? ' active' : ''}`}
            onClick={() => setFilter(key)}
          >
            <Icon size={16} />
            {t(labelKey)}
            <span className="filter-count">{counts[key] ?? 0}</span>
          </button>
        ))}
      </div>

      {filteredOrders.length === 0 ? (
        <div className="no-orders">
          <p>{search ? t('admin.orders.noResults', { query: search }) : t('admin.orders.empty')}</p>
        </div>
      ) : (
        <div className="orders-table">
          <div className="table-header">
            <span className="col-id">{t('admin.orders.colId')}</span>
            <span className="col-customer">{t('admin.orders.colCustomer')}</span>
            <span className="col-date">{t('admin.orders.colDate')}</span>
            <span className="col-total">{t('admin.orders.colTotal')}</span>
            <span className="col-status">{t('admin.orders.colStatus')}</span>
            <span className="col-actions">{t('admin.orders.colActions')}</span>
          </div>

          {filteredOrders.map(order => {
            const busy   = actionLoading === order.id;

            return (
              <div key={order.id} className="table-row">
                <span className="col-id">#{order.id}</span>

                <span className="col-customer">
                  <div className="customer-name">
                    {order.customerName || order.customerEmail || t('admin.orders.unknown')}
                  </div>
                  <div className="payment-method-badge">
                    {PAYMENT_METHOD_LABEL[order.paymentMethod] ? t(PAYMENT_METHOD_LABEL[order.paymentMethod]) : order.paymentGateway || order.paymentMethod || 'SePay'}
                  </div>
                </span>

                <span className="col-date">
                  <CalendarIcon size={15} />
                  {new Date(order.createdAt).toLocaleString(LOCALE_TAGS[locale])}
                </span>

                <span className="col-total">{formatMoney(order.totalAmount, locale)}</span>

                <span className="col-status">
                  <StatusPill status={order.status} t={t} />
                  {order.ghnOrderCode && (
                    <small className="shipping-state">
                      <TruckIcon size={13} />
                      {getShippingStatusLabel(order.shippingStatus, t)}
                    </small>
                  )}
                </span>

                <span className="col-actions">
                  <button
                    type="button"
                    className="btn-view"
                    onClick={() => setSelectedOrder(order)}
                  >
                    <DetailsIcon size={15} />
                    {t('admin.orders.details')}
                  </button>

                  {!order.ghnOrderCode && !['Delivered', 'Cancelled', 'Shipped'].includes(order.status) && (
                    <button
                      type="button"
                      className="btn-cancel"
                      disabled={busy}
                      onClick={() => handleUpdateStatus(order.id, 'Cancelled')}
                    >
                      {busy ? '…' : <><CloseIcon size={15} /> {t('admin.orders.cancel')}</>}
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
          onConfirmPayment={handleConfirmPayment}
          onCreateShipment={handleCreateShipment}
          onSetGhnCode={handleSetGhnCode}
          onRefreshTracking={handleRefreshTracking}
          onCancelShipment={handleCancelShipment}
          actionLoading={actionLoading}
          tracking={trackingData[selectedOrder.id]}
          trackingLoading={trackingLoading === selectedOrder.id}
          t={t}
          locale={locale}
        />
      )}
    </div>
  );
}
