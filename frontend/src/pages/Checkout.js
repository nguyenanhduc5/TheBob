import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { authAPI, cartAPI, ordersAPI } from '../api/app';
import '../styles/Checkout.css';

const decodeJwt = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    return {
      name: payload.name || payload.unique_name || payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] || '',
      email: payload.email || payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] || '',
      phone: payload.phone || payload.phoneNumber || payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/mobilephone'] || '',
      address: payload.address || payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/streetaddress'] || '',
    };
  } catch (e) {
    return null;
  }
};

export default function Checkout() {
  const navigate = useNavigate();
  const { cartItems, clearCart } = useCart();
  const { user, token } = useAuth();
  const { addNotification } = useNotification();

  const [formData, setFormData] = useState({
    fullName: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    address: user?.address || '',
    paymentMethod: 'cod',
  });
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const autoFillProfile = async () => {
      const savedToken = token || localStorage.getItem('thebob-token');
      if (!savedToken) return;

      // 1. Try decoding JWT first for quick fill
      const decoded = decodeJwt(savedToken);
      if (decoded) {
        setFormData(prev => ({
          ...prev,
          fullName: prev.fullName || decoded.name || '',
          email: prev.email || decoded.email || '',
          phone: prev.phone || decoded.phone || '',
          address: prev.address || decoded.address || '',
        }));
      }

      // 2. Fetch full profile details from database
      try {
        const result = await authAPI.getProfile();
        const profile = result?.data || result;
        if (profile) {
          setFormData(prev => ({
            ...prev,
            fullName: profile.name || profile.fullName || prev.fullName,
            email: profile.email || prev.email,
            phone: profile.phone || prev.phone,
            address: profile.address || prev.address,
          }));
        }
      } catch (error) {
        console.error('Failed to fetch profile in Checkout:', error);
      }
    };

    autoFillProfile();
  }, [token]);

  const handleInputChange = (field) => (e) => {
    setFormData({
      ...formData,
      [field]: e.target.value,
    });
  };

  const handleSubmitOrder = async (e) => {
    e.preventDefault();

    if (!formData.fullName || !formData.email || !formData.phone || !formData.address) {
      addNotification('Vui lòng điền đầy đủ thông tin giao hàng', 'warning');
      return;
    }

    setIsProcessing(true);

    try {
      const invalidItem = cartItems.find((item) => !item.variantId);
      if (invalidItem) {
        addNotification('Giỏ hàng có sản phẩm chưa chọn biến thể, vui lòng thêm lại sản phẩm.', 'error');
        setIsProcessing(false);
        return;
      }

      // Sync backend cart before checkout
      await cartAPI.clearCart();
      for (const item of cartItems) {
        await cartAPI.addItem(item.variantId, item.quantity);
      }

      const orderData = {
        shippingAddress: [
          formData.fullName,
          formData.phone,
          formData.email,
          formData.address,
        ].filter(Boolean).join(' - '),
        paymentMethod: formData.paymentMethod,
      };

      const order = await ordersAPI.createOrder(orderData);

      if (order) {
        addNotification('Đặt hàng thành công! Cảm ơn bạn đã mua sắm.', 'success');
        
        // Only clear cart locally for COD (since QR/Bank transfer is not paid yet)
        if (formData.paymentMethod === 'cod') {
          clearCart();
        }

        // Redirect to order confirmation page or payment page depending on payment method
        setTimeout(() => {
          if (formData.paymentMethod === 'bank_transfer' || formData.paymentMethod === 'qr') {
            navigate(`/payment/${order.id}`);
          } else {
            navigate(`/orders/${order.id}`);
          }
        }, 1000);
      }
    } catch (error) {
      console.error('Order submission error:', error);
      if (error?.status === 409 && error?.payload?.orderId) {
        addNotification(error.payload.message || 'Bạn đang có đơn hàng chờ thanh toán', 'warning');
        navigate(`/payment/${error.payload.orderId}`);
        return;
      }
      addNotification(error?.message || 'Lỗi khi xử lý đơn hàng', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  if (cartItems.length === 0) {
    return (
      <div className="checkout-page">
        <div className="empty-message">
          <h2>Giỏ hàng của bạn đang trống</h2>
          <p>Vui lòng thêm sản phẩm trước khi thanh toán.</p>
          <button onClick={() => navigate('/products')} className="btn-back-shopping">
            Quay lại mua sắm
          </button>
        </div>
      </div>
    );
  }

  const subtotal = cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  const shipping = subtotal > 500000 ? 0 : 30000;
  const total = subtotal + shipping;

  return (
    <div className="checkout-page">
      <h1>Thanh Toán</h1>

      <div className="checkout-container">
        {/* Checkout Form */}
        <div className="checkout-form-section">
          <form onSubmit={handleSubmitOrder} className="checkout-form">
            <div className="form-section">
              <h2>Thông Tin Giao Hàng</h2>

              <div className="form-group">
                <label>Họ và Tên *</label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={handleInputChange('fullName')}
                  placeholder="Nguyễn Anh Đức"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange('email')}
                    placeholder="email@example.com"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Số Điện Thoại *</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={handleInputChange('phone')}
                    placeholder="0908474355"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Địa Chỉ Giao Hàng *</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={handleInputChange('address')}
                  placeholder="76 Nguyễn Sơn, Phú Thọ Hòa, Tân Phú, TPHCM"
                  required
                />
              </div>
            </div>

            <div className="form-section">
              <h2>Phương Thức Thanh Toán</h2>

              <div className="payment-options">
                <div className="payment-option">
                  <input
                    type="radio"
                    id="payment-cod"
                    name="paymentMethod"
                    value="cod"
                    checked={formData.paymentMethod === 'cod'}
                    onChange={handleInputChange('paymentMethod')}
                  />
                  <label htmlFor="payment-cod">
                    <span className="payment-title">Thanh Toán Khi Nhận Hàng (COD)</span>
                    <span className="payment-description">Trả tiền khi nhận hàng</span>
                  </label>
                </div>

                <div className="payment-option">
                  <input
                    type="radio"
                    id="payment-bank"
                    name="paymentMethod"
                    value="bank_transfer"
                    checked={formData.paymentMethod === 'bank_transfer'}
                    onChange={handleInputChange('paymentMethod')}
                  />
                  <label htmlFor="payment-bank">
                    <span className="payment-title">Chuyển Khoản QR Banking</span>
                    <span className="payment-description">Chuyển tiền vào tài khoản</span>
                  </label>
                </div>

                <div className="payment-option">
                  <input
                    type="radio"
                    id="payment-qr"
                    name="paymentMethod"
                    value="qr"
                    checked={formData.paymentMethod === 'qr'}
                    onChange={handleInputChange('paymentMethod')}
                  />
                  <label htmlFor="payment-qr">
                    <span className="payment-title">Thanh Toán Bằng QR Code</span>
                    <span className="payment-description">Quét mã QR Code chuyển khoản</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button
                type="button"
                onClick={() => navigate('/cart')}
                className="btn-back"
              >
                Quay Lại Giỏ Hàng
              </button>
              <button
                type="submit"
                disabled={isProcessing}
                className="btn-place-order"
              >
                {isProcessing ? 'Đang xử lý...' : 'Đặt Hàng'}
              </button>
            </div>
          </form>
        </div>

        {/* Order Summary */}
        <div className="order-summary-section">
          <div className="order-summary">
            <h2>Tóm Tắt Đơn Hàng</h2>

            <div className="summary-items">
              {cartItems.map((item) => (
                <div key={`${item.id}-${item.selectedSize}`} className="summary-item">
                  <div className="item-name">
                    <span>{item.name}</span>
                    <span className="item-quantity">x{item.quantity}</span>
                  </div>
                  <span className="item-total">
                    {(item.price * item.quantity).toLocaleString('vi-VN')} VNĐ
                  </span>
                </div>
              ))}
            </div>

            <div className="summary-divider"></div>

            <div className="summary-row">
              <span>Tạm tính:</span>
              <span>{subtotal.toLocaleString('vi-VN')} VNĐ</span>
            </div>

            <div className="summary-row">
              <span>Phí vận chuyển:</span>
              <span>{shipping === 0 ? 'Miễn Phí' : shipping.toLocaleString('vi-VN') + ' VNĐ'}</span>
            </div>

            <div className="summary-row total">
              <span>Tổng Cộng:</span>
              <span>{total.toLocaleString('vi-VN')} VNĐ</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
