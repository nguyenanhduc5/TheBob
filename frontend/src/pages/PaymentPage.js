import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as signalR from '@microsoft/signalr';
import { ordersAPI, paymentAPI, ORDER_HUB_URL } from '../api/app';
import { useNotification } from '../context/NotificationContext';
import { useCart } from '../context/CartContext';
import '../styles/Payment.css';
import '../styles/PaymentFeedback.css';

const PAYMENT_WINDOW_SECONDS = 15 * 60;

export default function PaymentPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { addNotification } = useNotification();
  const { clearCart } = useCart();

  const [order, setOrder] = useState(null);
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timer, setTimer] = useState(PAYMENT_WINDOW_SECONDS);
  const [isPaid, setIsPaid] = useState(false);

  const timerRef = useRef(null);
  const completedRef = useRef(false);

  const stopCountdown = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const goSuccess = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    stopCountdown();
    clearCart();
    setIsPaid(true);
    setLoading(false);
    addNotification('Thanh toan thanh cong!', 'success');
    setTimeout(() => navigate('/payment/success'), 1200);
  }, [addNotification, clearCart, navigate, stopCountdown]);

  const goFailed = useCallback((path = '/payment/failed') => {
    if (completedRef.current) return;
    completedRef.current = true;
    stopCountdown();
    setLoading(false);
    navigate(path);
  }, [navigate, stopCountdown]);

  useEffect(() => {
    let isMounted = true;

    const loadPayment = async () => {
      try {
        setLoading(true);
        setError(null);

        const orderData = await ordersAPI.getOrder(orderId);
        if (!isMounted) return;

        if (orderData.paymentStatus === 'Paid') {
          goSuccess();
          return;
        }

        if (orderData.paymentStatus === 'Failed') {
          goFailed('/payment/failed');
          return;
        }

        if (orderData.paymentStatus === 'Expired' || orderData.status === 'Cancelled') {
          goFailed('/payment/expired');
          return;
        }

        const status = await paymentAPI.getPaymentStatus(orderId);
        if (!isMounted) return;

        setTimer(Math.max(0, status.remainingSeconds ?? PAYMENT_WINDOW_SECONDS));
        if (status.paymentStatus === 'Paid') {
          goSuccess();
          return;
        }
        if (status.paymentStatus === 'Failed') {
          goFailed('/payment/failed');
          return;
        }
        if (status.paymentStatus === 'Expired') {
          goFailed('/payment/expired');
          return;
        }

        const payment = await paymentAPI.createPayment(Number(orderId), orderData.totalAmount);
        if (!isMounted) return;

        setOrder(orderData);
        setPaymentInfo(payment);
        setLoading(false);
      } catch (err) {
        console.error('Error loading SePay payment page:', err);
        if (isMounted) {
          setError(err?.message || 'Khong the tai thong tin thanh toan.');
          setLoading(false);
        }
      }
    };

    loadPayment();

    return () => {
      isMounted = false;
    };
  }, [goFailed, goSuccess, orderId]);

  useEffect(() => {
    const token = localStorage.getItem('thebob-token');
    if (!token) return;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(ORDER_HUB_URL, { accessTokenFactory: () => token })
      .withAutomaticReconnect()
      .build();

    const matchesOrder = (receivedOrderId) => String(receivedOrderId) === String(orderId);

    connection.on('ReceivePaymentSuccess', (receivedOrderId, message) => {
  if (matchesOrder(receivedOrderId)) goSuccess();
});

    connection.on('ReceivePaymentFailed', (receivedOrderId) => {
      if (matchesOrder(receivedOrderId)) goFailed('/payment/failed');
    });

    connection.on('ReceivePaymentExpired', (receivedOrderId) => {
      if (matchesOrder(receivedOrderId)) goFailed('/payment/expired');
    });

    connection.start().catch((err) => console.error('Payment SignalR failed:', err));

    return () => {
      connection.off('ReceivePaymentSuccess');
      connection.off('ReceivePaymentFailed');
      connection.off('ReceivePaymentExpired');
      connection.stop().catch((err) => console.error('Payment SignalR stop failed:', err));
    };
  }, [goFailed, goSuccess, orderId]);

  useEffect(() => {
    if (loading || error || isPaid || !order) return;

    const poll = setInterval(async () => {
      try {
        const status = await paymentAPI.getPaymentStatus(orderId);
        setTimer(Math.max(0, status.remainingSeconds ?? 0));

        if (status.paymentStatus === 'Paid') goSuccess();
        if (status.paymentStatus === 'Failed') goFailed('/payment/failed');
        if (status.paymentStatus === 'Expired') goFailed('/payment/expired');
      } catch (err) {
        console.error('Payment status polling failed:', err);
      }
    }, 5000);

    return () => clearInterval(poll);
  }, [error, goFailed, goSuccess, isPaid, loading, order, orderId]);

  useEffect(() => {
    if (loading || error || isPaid || !order) return;

    stopCountdown();
    timerRef.current = setInterval(() => {
      setTimer((value) => Math.max(0, value - 1));
    }, 1000);

    return stopCountdown;
  }, [error, isPaid, loading, order, stopCountdown]);

  useEffect(() => {
    if (loading || error || isPaid || !order || timer > 0 || completedRef.current) return;

    paymentAPI.cancelPayment(orderId)
      .catch((err) => console.error('Auto expire cancel failed:', err))
      .finally(() => goFailed('/payment/expired'));
  }, [error, goFailed, isPaid, loading, order, orderId, timer]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const copy = (value, message) => {
    navigator.clipboard.writeText(value || '');
    addNotification(message, 'success');
  };

  const handleCancelPayment = async () => {
    if (!window.confirm('Bạn muốn hủy thanh toán đơn hàng này?')) return;

    setLoading(true);
    try {
      await paymentAPI.cancelPayment(orderId);
      goFailed('/payment/failed');
    } catch (err) {
      addNotification(err?.message || 'Lỗi khi hủy thanh toán.', 'error');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="payment-loading-container">
        <div className="spinner"></div>
        <p>Đang tải thông tin thanh toán...</p>
      </div>
    );
  }

  if (isPaid) {
    return (
      <div className="payment-feedback-container">
        <div className="feedback-card">
          <div className="feedback-icon-wrapper success">
            <svg className="feedback-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h1>Thanh toan thanh cong!</h1>
<p>Đơn hàng của bạn đã được SePay xác nhận và đang được xử lý.</p>        
</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="payment-error-container">
        <div className="error-card">
          <div className="error-icon">x</div>
          <h2>Lỗi thanh toán</h2>
          <p>{error}</p>
          <button onClick={() => navigate('/checkout')} className="btn-retry">Quay lại thanh toán</button>
        </div>
      </div>
    );
  }

  return (
    <div className="payment-page-wrapper">
      <div className="payment-card-container">
        <div className="payment-info-box">
          <h2>Thanh Toán Đơn Hàng</h2>
          <div className="timer-display">
            Thực hiện thanh toán trong: <span className="countdown">{formatTime(timer)}</span>
          </div>

          <div className="info-fields">
            <div className="info-row">
              <span className="info-label">Ngân hàng</span>
              <span className="info-value highlight">{paymentInfo?.bankName}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Số tài khoản</span>
              <span className="info-value copyable">
                {paymentInfo?.bankAccount}
                <button className="btn-copy" onClick={() => copy(paymentInfo?.bankAccount, 'Đã sao chép số tài khoản')}>Sao chép</button>
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">Virtual Account</span>
              <span className="info-value copyable">
                {paymentInfo?.vaNumber}
                <button className="btn-copy" onClick={() => copy(paymentInfo?.vaNumber, 'Đã sao chép VA')}>Sao chép</button>
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">Chủ tài khoản</span>
              <span className="info-value">{paymentInfo?.accountName}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Nộidung chuyển khoản</span>
              <span className="info-value copyable content-highlight">
                {paymentInfo?.transferContent}
                <button className="btn-copy" onClick={() => copy(paymentInfo?.transferContent, 'Da sao chep noi dung')}>Sao chep</button>
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">Số tiền</span>
              <span className="info-value price-highlight">
                {paymentInfo?.amount?.toLocaleString('vi-VN')} VND
              </span>
            </div>
          </div>

          <div className="payment-note-box">
            <p><strong>Lưu ý:</strong> Chuyển đúng số tiền và nội dung. SePay sẽ tự động gửi webhook sau khi ngân hàng ghi nhận giao dịch.</p>
          </div>

          <div style={{ marginTop: '20px' }}>
            <button onClick={handleCancelPayment} className="btn-retry" style={{ backgroundColor: '#e53e3e', width: '100%' }}>
              Hủy thanh toán
            </button>
          </div>
        </div>

        <div className="payment-qr-box">
          <h3>Quét mã để thanh toán</h3>
          <div className="qr-image-wrapper">
            <img src={paymentInfo?.qrCode} alt="SePay VietQR Code" className="viet-qr-img" />
          </div>
          <div className="payment-status-indicator">
            <span className="pulse-dot"></span>
            Đang cho SePay xác nhận giao dịch...
          </div>
        </div>
      </div>
    </div>
  );
}
