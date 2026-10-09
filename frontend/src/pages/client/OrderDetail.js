import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { usePreferences } from '../../context/PreferencesContext';
import { ordersAPI } from '../../api/app';
import '../../styles/OrderDetail.css';

export default function OrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { addNotification } = useNotification();
  const { t, locale } = usePreferences();

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
      addNotification(error.message || t('order.loadError'), 'error');
      navigate(isAdmin() ? '/admin/orders' : '/user/profile?menu=orders');
    } finally {
      setLoading(false);
    }
  }, [addNotification, isAdmin, navigate, orderId, t]);

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
    if (!window.confirm(t('order.cancel.confirm'))) return;

    setCancelling(true);
    try {
      const updatedOrder = await ordersAPI.cancelOrder(orderId);
      setOrder(updatedOrder);
      addNotification(t('order.cancel.success'), 'success');
    } catch (error) {
      addNotification(error.message || t('order.cancel.error'), 'error');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return <div className="loading-page">{t('order.loading')}</div>;
  }

  if (!order) {
    return <div className="error-page">{t('order.notFound')}</div>;
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
    return t(`order.status.${status}`) === `order.status.${status}` ? status : t(`order.status.${status}`);
  };

  const formatDateTime = (value) => {
    if (!value) return t('order.noDate');
    return new Date(value).toLocaleString(locale);
  };

  return (
    <div className="order-detail-page">
      <div className="order-header">
        <h1>{t('order.title')}</h1>
        <button onClick={() => navigate(isAdmin() ? '/admin/orders' : '/user/profile?menu=orders')} className="btn-back">
          {t('order.back')}
        </button>
      </div>

      <div className="order-container">
        <div className="order-info-section">
          <div className="info-card">
            <h2>{t('order.information')}</h2>
            <div className="info-row">
              <span className="label">{t('order.number')}</span>
              <span className="value">{order.orderNumber || order.id}</span>
            </div>
            <div className="info-row">
              <span className="label">{t('order.date')}</span>
              <span className="value">
                {new Date(order.createdAt).toLocaleDateString('vi-VN')}
              </span>
            </div>
            <div className="info-row">
              <span className="label">{t('order.status')}</span>
              <span className={`status ${getStatusBadgeClass(order.status)}`}>
                {getStatusLabel(order.status)}
              </span>
            </div>
            <div className="info-row">
              <span className="label">{t('order.total')}</span>
              <span className="value total">
                {order.totalAmount.toLocaleString('vi-VN')} VNĐ
              </span>
            </div>
          </div>

          <div className="info-card">
            <h2>{t('order.address')}</h2>
            <div className="shipping-address">
              <p>{order.shippingAddress}</p>
            </div>
          </div>

          <div className="info-card">
            <h2>{t('order.paymentMethod')}</h2>
            <p>{t(`order.payment.${order.paymentMethod}`) === `order.payment.${order.paymentMethod}` ? order.paymentMethod || t('order.unknown') : t(`order.payment.${order.paymentMethod}`)}</p>
          </div>

          {(order.ghnOrderCode || order.shippingStatus) && (
            <div className="info-card">
              <h2>{t('order.shippingInfo')}</h2>
              <div className="info-row">
                <span className="label">{t('order.trackingCode')}</span>
                <span className="value mono-value">{order.ghnOrderCode || t('order.noDate')}</span>
              </div>
              <div className="info-row">
                <span className="label">{t('order.shippingStatus')}</span>
                <span className="value">{order.shippingStatus || t('order.waitingUpdate')}</span>
              </div>
            </div>
          )}

          {isAdmin() && (
            <div className="info-card">
              <h2>{t('order.paymentReconciliation')}</h2>
              <div className="info-row">
                <span className="label">{t('order.paymentProvider')}</span>
                <span className="value">{order.paymentProvider || order.paymentGateway || 'SePay'}</span>
              </div>
              <div className="info-row">
                <span className="label">{t('order.virtualAccount')}</span>
                <span className="value mono-value">{order.vaNumber || t('order.notRecorded')}</span>
              </div>
              <div className="info-row">
                <span className="label">{t('order.transactionId')}</span>
                <span className="value mono-value">{order.transactionId || t('order.notRecorded')}</span>
              </div>
              <div className="info-row">
                <span className="label">{t('order.transactionCode')}</span>
                <span className="value mono-value">{order.transactionCode || t('order.notRecorded')}</span>
              </div>
              <div className="info-row">
                <span className="label">{t('order.webhookTime')}</span>
                <span className="value">{formatDateTime(order.webhookTime)}</span>
              </div>
              <div className="info-row">
                <span className="label">{t('order.paidAt')}</span>
                <span className="value">{formatDateTime(order.paidAt)}</span>
              </div>
              <div className="info-row">
                <span className="label">{t('order.failureReason')}</span>
                <span className="value">{order.failureReason || t('order.none')}</span>
              </div>
            </div>
          )}
        </div>

        <div className="order-items-section">
          <div className="items-card">
            <h2>{t('order.items')}</h2>
            <div className="items-table">
              <div className="items-header">
                <span className="col-name">{t('order.item')}</span>
                <span className="col-price">{t('order.unitPrice')}</span>
                <span className="col-quantity">{t('order.quantity')}</span>
                <span className="col-total">{t('order.amount')}</span>
              </div>

              {order.items && order.items.map((item) => (
                <div key={item.id} className="item-row">
                  <span className="col-name">
                    <div>
                      {item.productName}
                      {item.size && <span className="item-meta"> - {t('cart.size')}: {item.size}</span>}
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
                <span>{t('cart.subtotal.label')}</span>
                <span>
                  {(order.subtotal ?? order.totalAmount).toLocaleString('vi-VN')} VNĐ
                </span>
              </div>
              <div className="summary-row">
                <span>{t('cart.shipping')}</span>
                <span>{(order.shippingAmount ?? 0).toLocaleString('vi-VN')} VNĐ</span>
              </div>
              <div className="summary-row total">
                <span>{t('order.total')}</span>
                <span>{order.totalAmount.toLocaleString('vi-VN')} VNĐ</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="order-actions">
        <button onClick={() => navigate('/products')} className="btn-continue-shopping">
          {t('cart.continue.button')}
        </button>
        {!isAdmin() && (order.status === 'Pending' || order.status === 'Processing') && (
          <button className="btn-cancel" onClick={handleCancelOrder} disabled={cancelling}>
            {cancelling ? t('order.cancel.loading') : t('order.cancel.button')}
          </button>
        )}
      </div>
    </div>
  );
}
