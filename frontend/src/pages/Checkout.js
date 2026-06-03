import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import '../styles/Checkout.css';

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

  const calculateTotal = () => {
    const subtotal = cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
    const shipping = subtotal > 500000 ? 0 : 30000;
    return subtotal + shipping;
  };

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
      const orderData = {
        userId: user?.id,
        totalAmount: calculateTotal(),
        shippingAddress: formData.address,
        paymentMethod: formData.paymentMethod,
        items: cartItems.map(item => ({
          productId: item.id,
          quantity: item.quantity,
          price: item.price,
          size: item.selectedSize,
          color: item.selectedColor,
        })),
      };

      const response = await fetch('http://localhost:5110/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(orderData),
      });

      if (response.ok) {
        const order = await response.json();
        addNotification('Đặt hàng thành công! Cảm ơn bạn đã mua sắm.', 'success');
        clearCart();
        
        // Redirect to order confirmation page
        setTimeout(() => {
          navigate(`/orders/${order.id}`);
        }, 1000);
      } else {
        const errorData = await response.json();
        addNotification(errorData.message || 'Lỗi khi đặt hàng', 'error');
      }
    } catch (error) {
      console.error('Order submission error:', error);
      addNotification('Lỗi khi xử lý đơn hàng', 'error');
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
                    value="bank"
                    checked={formData.paymentMethod === 'bank'}
                    onChange={handleInputChange('paymentMethod')}
                  />
                  <label htmlFor="payment-bank">
                    <span className="payment-title">Chuyển Khoản Ngân Hàng</span>
                    <span className="payment-description">Chuyển tiền vào tài khoản</span>
                  </label>
                </div>

                <div className="payment-option">
                  <input
                    type="radio"
                    id="payment-card"
                    name="paymentMethod"
                    value="card"
                    checked={formData.paymentMethod === 'card'}
                    onChange={handleInputChange('paymentMethod')}
                  />
                  <label htmlFor="payment-card">
                    <span className="payment-title">Thẻ Tín Dụng / Ghi Nợ</span>
                    <span className="payment-description">Thanh toán bằng thẻ</span>
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
