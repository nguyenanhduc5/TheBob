import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ordersAPI, paymentAPI } from '../api/app';
import { useNotification } from '../context/NotificationContext';
import '../styles/Payment.css';

const PAYMENT_WINDOW_SECONDS = 15 * 60;

export default function PaymentPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { addNotification } = useNotification();

  const [order, setOrder] = useState(null);
  const [qrDetails, setQrDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timer, setTimer] = useState(PAYMENT_WINDOW_SECONDS);
  const [expired, setExpired] = useState(false);

  const completedRef = useRef(false);
  const cancellingRef = useRef(false);

  const goToSuccess = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    addNotification('Thanh toán thành công!', 'success');
    navigate('/payment/success');
  }, [addNotification, navigate]);

  const cancelPayment = useCallback(async (redirect = true) => {
    if (completedRef.current || cancellingRef.current) return;

    cancellingRef.current = true;
    try {
      await paymentAPI.cancelPayment(orderId);
      completedRef.current = true;
      setExpired(true);
      if (redirect) {
        navigate('/payment/failed');
      }
    } catch (err) {
      addNotification(err?.message || 'Lỗi khi hủy thanh toán.', 'error');
    } finally {
      cancellingRef.current = false;
    }
  }, [addNotification, navigate, orderId]);

  useEffect(() => {
    let isMounted = true;

    const fetchDetails = async () => {
      try {
        setLoading(true);
        setError(null);

        const orderData = await ordersAPI.getOrder(orderId);
        if (!isMounted) return;

        if (orderData.paymentStatus === 'Paid') {
          goToSuccess();
          return;
        }

        if (
          orderData.paymentStatus === 'Cancelled' ||
          orderData.paymentStatus === 'Expired' ||
          orderData.status === 'Cancelled'
        ) {
          setExpired(true);
          setLoading(false);
          return;
        }

        const status = await paymentAPI.getPaymentStatus(orderId);
        if (!isMounted) return;

        if (status.paymentStatus === 'Paid') {
          goToSuccess();
          return;
        }

        setTimer(Math.max(0, status.remainingSeconds ?? PAYMENT_WINDOW_SECONDS));
        if (status.isExpired || status.paymentStatus === 'Expired' || status.paymentStatus === 'Cancelled') {
          setExpired(true);
          setLoading(false);
          return;
        }

        const qrResponse = await paymentAPI.createQrPayment({
          amount: orderData.totalAmount,
          orderInfo: `THEBOB_${orderData.id}`
        });

        if (!isMounted) return;
        setOrder(orderData);
        setQrDetails(qrResponse);
        setLoading(false);
      } catch (err) {
        console.error('Error loading payment details:', err);
        if (isMounted) {
          setError(err?.message || 'Không thể tải thông tin thanh toán.');
          setLoading(false);
        }
      }
    };

    fetchDetails();

    return () => {
      isMounted = false;
    };
  }, [goToSuccess, orderId]);

  useEffect(() => {
    if (loading || error || expired || !order) return;

    const checkStatus = async () => {
      try {
        const status = await paymentAPI.getPaymentStatus(orderId);
        setTimer(Math.max(0, status.remainingSeconds ?? 0));

        if (status.paymentStatus === 'Paid') {
          goToSuccess();
          return;
        }

        if (status.isExpired) {
          await cancelPayment(true);
          return;
        }

        if (status.paymentStatus === 'Expired' || status.paymentStatus === 'Cancelled') {
          completedRef.current = true;
          setExpired(true);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    };

    const pollInterval = setInterval(checkStatus, 5000);

    const handleSignalRPaymentSuccess = (e) => {
      if (parseInt(e.detail.orderId, 10) === parseInt(orderId, 10)) {
        goToSuccess();
      }
    };

    window.addEventListener('payment-success-received', handleSignalRPaymentSuccess);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('payment-success-received', handleSignalRPaymentSuccess);
    };
  }, [cancelPayment, error, expired, goToSuccess, loading, order, orderId]);

  useEffect(() => {
    if (loading || error || expired || !order) return;

    const countdown = setInterval(() => {
      setTimer(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(countdown);
  }, [error, expired, loading, order]);

  useEffect(() => {
    if (loading || error || expired || !order || timer > 0 || completedRef.current) return;

    addNotification('Thời gian thanh toán đã hết hạn.', 'warning');
    cancelPayment(true);
  }, [addNotification, cancelPayment, error, expired, loading, order, timer]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCancelPayment = async () => {
    if (!window.confirm('Bạn muốn hủy thanh toán đơn hàng này?')) return;

    setLoading(true);
    await cancelPayment(true);
    addNotification('Đã hủy thanh toán.', 'info');
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="payment-loading-container">
        <div className="spinner"></div>
        <p>Đang tải thông tin thanh toán...</p>
      </div>
    );
  }

  if (expired) {
    return (
      <div className="payment-error-container">
        <div className="error-card">
          <div className="error-icon" style={{ backgroundColor: '#fff5f5', borderColor: '#fed7d7', color: '#e53e3e' }}>x</div>
          <h2>Đơn hàng đã hết hạn thanh toán</h2>
          <p>Thời gian thanh toán 15 phút cho đơn hàng này đã kết thúc. Vui lòng tạo đơn hàng mới.</p>
          <button onClick={() => navigate('/products')} className="btn-retry">Quay lại mua sắm</button>
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
          <h2>Thông Tin Chuyển Khoản</h2>
          <div className="timer-display">
            Thực hiện thanh toán trong: <span className="countdown">{formatTime(timer)}</span>
          </div>

          <div className="info-fields">
            <div className="info-row">
              <span className="info-label">Ngân hàng</span>
              <span className="info-value highlight">{qrDetails?.bankName}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Số tài khoản</span>
              <span className="info-value copyable">
                {qrDetails?.accountNumber}
                <button
                  className="btn-copy"
                  onClick={() => {
                    navigator.clipboard.writeText(qrDetails?.accountNumber || '');
                    addNotification('Đã sao chép số tài khoản', 'success');
                  }}
                >
                  Sao chép
                </button>
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">Chủ tài khoản</span>
              <span className="info-value">{qrDetails?.accountName}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Số tiền</span>
              <span className="info-value price-highlight">
                {qrDetails?.amount?.toLocaleString('vi-VN')} VND
                <button
                  className="btn-copy"
                  onClick={() => {
                    navigator.clipboard.writeText(qrDetails?.amount?.toString() || '');
                    addNotification('Đã sao chép số tiền', 'success');
                  }}
                >
                  Sao chép
                </button>
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">Nội dung chuyển khoản</span>
              <span className="info-value copyable content-highlight">
                {qrDetails?.content}
                <button
                  className="btn-copy"
                  onClick={() => {
                    navigator.clipboard.writeText(qrDetails?.content || '');
                    addNotification('Đã sao chép nội dung chuyển khoản', 'success');
                  }}
                >
                  Sao chép
                </button>
              </span>
            </div>
          </div>

          <div className="payment-note-box">
            <p><strong>Lưu ý:</strong> Vui lòng chuyển chính xác số tiền và nội dung chuyển khoản ở trên để đơn hàng được xác nhận.</p>
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
            <img src={qrDetails?.qrUrl} alt="VietQR Code" className="viet-qr-img" />
          </div>
          <div className="payment-status-indicator">
            <span className="pulse-dot"></span>
            Đang chờ bạn quét mã và chuyển tiền...
          </div>
        </div>
      </div>
    </div>
  );
}
