import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useNotification } from '../context/NotificationContext';
import '../styles/Cart.css';

export default function Cart() {
  const navigate = useNavigate();
  const { cartItems, removeFromCart, updateQuantity, clearCart } = useCart();
  const { addNotification } = useNotification();
  const [appliedCoupon, setAppliedCoupon] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);

  const calculateSubtotal = () => {
    return cartItems.reduce((total, item) => total + ((item.price ?? 0) * (item.quantity ?? 1)), 0);
  };

  const subtotal = calculateSubtotal();
  const discount = (subtotal * discountPercent) / 100;
  const shipping = subtotal > 500000 ? 0 : 30000;
  const total = subtotal - discount + shipping;

  const handleApplyCoupon = () => {
    // Simple demo coupon logic
    if (appliedCoupon.toUpperCase() === 'SAVE10') {
      setDiscountPercent(10);
      addNotification('Mã giảm giá hợp lệ! Giảm 10%', 'success');
    } else if (appliedCoupon.toUpperCase() === 'SAVE20') {
      setDiscountPercent(20);
      addNotification('Mã giảm giá hợp lệ! Giảm 20%', 'success');
    } else {
      addNotification('Mã giảm giá không hợp lệ', 'error');
    }
    setAppliedCoupon('');
  };

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [itemToRemove, setItemToRemove] = useState(null);

  const getItemKey = (item) => item.variantId ?? item.id;

  const handleIncreaseQty = (item) => {
    if (item.quantity + 1 > item.stock) {
      addNotification(`Sản phẩm này chỉ còn tối đa ${item.stock} mục trong kho`, 'warning');
      return;
    }
    updateQuantity(getItemKey(item), item.quantity + 1);
  };

  const handleDecreaseQty = (item) => {
    if (item.quantity <= 1) {
      setItemToRemove(getItemKey(item));
      setShowConfirmModal(true);
    } else {
      updateQuantity(getItemKey(item), item.quantity - 1);
    }
  };

  const handleRemoveItem = (itemKey) => {
    removeFromCart(itemKey);
    addNotification('Đã xóa sản phẩm khỏi giỏ hàng', 'info');
  };

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      addNotification('Giỏ hàng của bạn đang trống', 'warning');
      return;
    }
    navigate('/checkout');
  };

  if (cartItems.length === 0) {
    return (
      <div className="cart-page">
        <div className="cart-empty">
          <div className="empty-icon">🛒</div>
          <h2>Giỏ hàng của bạn đang trống</h2>
          <p>Hãy thêm một số sản phẩm để tiếp tục.</p>
          <button
            onClick={() => navigate('/products')}
            className="btn-continue-shopping"
          >
            Tiếp tục mua sắm
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <h1>Giỏ Hàng</h1>

      <div className="cart-container">
        {/* Cart Items */}
        <div className="cart-items-section">
          <div className="cart-items-header">
            <span className="col-product">Sản Phẩm</span>
            <span className="col-price">Giá</span>
            <span className="col-quantity">Số Lượng</span>
            <span className="col-subtotal">Thành Tiền</span>
            <span className="col-action">Thao Tác</span>
          </div>

          {cartItems.map((item) => (
            <div key={`${getItemKey(item)}-${item.selectedSize}-${item.selectedColor}`} className="cart-item">
              <div className="col-product">
                <img
                  src={item.mainImageUrl || '/placeholder.jpg'}
                  alt={item.name}
                  className="item-image"
                />
                <div className="item-details">
                  <h3>{item.name}</h3>
                  {item.selectedSize && <p>Kích thước: {item.selectedSize}</p>}
                  {item.selectedColor && <p>Màu: {item.selectedColor}</p>}
                </div>
              </div>
              <div className="col-price">
                {(item.price ?? 0).toLocaleString('vi-VN')} VNĐ
              </div>
              <div className="col-quantity">
                <button
                  onClick={() => handleDecreaseQty(item)}
                  className="qty-btn"
                >
                  −
                </button>
                <input type="number" value={item.quantity} readOnly />
                <button
                  onClick={() => handleIncreaseQty(item)}
                  className="qty-btn"
                >
                  +
                </button>
              </div>
              <div className="col-subtotal">
                {((item.price ?? 0) * (item.quantity ?? 1)).toLocaleString('vi-VN')} VNĐ
              </div>
              <div className="col-action">
                <button
                  onClick={() => handleRemoveItem(getItemKey(item))}
                  className="btn-remove"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Cart Summary */}
        <div className="cart-summary">
          <h2>Tóm Tắt Đơn Hàng</h2>

          <div className="coupon-section">
            <input
              type="text"
              placeholder="Nhập mã giảm giá"
              value={appliedCoupon}
              onChange={(e) => setAppliedCoupon(e.target.value)}
              className="coupon-input"
            />
            <button onClick={handleApplyCoupon} className="btn-apply-coupon">
              Áp Dụng
            </button>
          </div>

          <div className="summary-row">
            <span>Tạm tính:</span>
            <span>{(subtotal ?? 0).toLocaleString('vi-VN')} VNĐ</span>
          </div>

          {discount > 0 && (
            <div className="summary-row discount">
              <span>Giảm giá ({discountPercent}%):</span>
              <span>-{(discount ?? 0).toLocaleString('vi-VN')} VNĐ</span>
            </div>
          )}

          <div className="summary-row">
            <span>Phí vận chuyển:</span>
            <span>{shipping === 0 ? 'Miễn Phí' : (shipping ?? 0).toLocaleString('vi-VN') + ' VNĐ'}</span>
          </div>

          <div className="summary-row total">
            <span>Tổng cộng:</span>
            <span>{(total ?? 0).toLocaleString('vi-VN')} VNĐ</span>
          </div>

          <button
            onClick={handleCheckout}
            className="btn-checkout"
          >
            Tiến Hành Thanh Toán
          </button>

          <button
            onClick={() => navigate('/products')}
            className="btn-continue-shopping-secondary"
          >
            Tiếp Tục Mua Sắm
          </button>

          <button
            onClick={() => {
              clearCart();
              addNotification('Đã xóa tất cả sản phẩm', 'info');
            }}
            className="btn-clear-cart"
          >
            Xóa Tất Cả
          </button>
        </div>
      </div>

      {showConfirmModal && (
        <div className="confirm-modal-overlay">
          <div className="confirm-modal">
            <h3>Xác nhận xóa</h3>
            <p>Bạn có chắc chắn muốn xóa sản phẩm này khỏi giỏ hàng?</p>
            <div className="confirm-modal-actions">
              <button 
                className="confirm-modal-btn btn-cancel" 
                onClick={() => {
                  setShowConfirmModal(false);
                  setItemToRemove(null);
                }}
              >
                Hủy
              </button>
              <button 
                className="confirm-modal-btn btn-confirm" 
                onClick={() => {
                  removeFromCart(itemToRemove);
                  addNotification('Đã xóa sản phẩm khỏi giỏ hàng', 'info');
                  setShowConfirmModal(false);
                  setItemToRemove(null);
                }}
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
