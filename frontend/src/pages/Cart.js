import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useNotification } from '../context/NotificationContext';
import { couponsAPI } from '../api/app';
import '../styles/Cart.css';

export default function Cart() {
  const navigate = useNavigate();
  const { cartItems, removeFromCart, updateQuantity, clearCart } = useCart();
  const { addNotification } = useNotification();
  const [appliedCoupon, setAppliedCoupon] = useState('');
  const [activeCoupon, setActiveCoupon] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [itemToRemove, setItemToRemove] = useState(null);

  const getItemKey = (item) => item.variantId ?? item.id;

  const calculateSubtotal = () => {
    return cartItems.reduce((total, item) => total + ((item.price ?? 0) * (item.quantity ?? 1)), 0);
  };

  const subtotal = calculateSubtotal();

  const calculateDiscount = () => {
    if (!activeCoupon) return 0;
    if (activeCoupon.productId) {
      const targetItems = cartItems.filter(item =>
        String(item.productId) === String(activeCoupon.productId) ||
        String(item.id) === String(activeCoupon.productId)
      );
      const targetSubtotal = targetItems.reduce((t, i) => t + ((i.price ?? 0) * (i.quantity ?? 1)), 0);
      return (targetSubtotal * activeCoupon.discountPercent) / 100;
    }
    return (subtotal * activeCoupon.discountPercent) / 100;
  };

  const discount = calculateDiscount();

  // ✅ FIX 3: Không tính ship ở trang Cart - chỉ tính khi checkout có địa chỉ
  const total = subtotal - discount;

  const handleApplyCoupon = async () => {
    if (!appliedCoupon.trim()) return;
    try {
      const coupon = await couponsAPI.getByCode(appliedCoupon.trim().toUpperCase());
      if (coupon && coupon.discountPercent) {
        if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) {
          addNotification('Mã giảm giá này đã hết hạn', 'warning');
          return;
        }
        setActiveCoupon(coupon);
        addNotification(`Áp dụng mã ${coupon.code} thành công! Giảm ${coupon.discountPercent}%`, 'success');
      } else {
        addNotification('Mã giảm giá không tồn tại', 'error');
      }
    } catch (error) {
      addNotification('Mã giảm giá không hợp lệ hoặc đã hết lượt dùng', 'error');
    }
    setAppliedCoupon('');
  };

  const handleIncreaseQty = (item) => {
    if (item.quantity + 1 > item.stock) {
      addNotification(`Sản phẩm này chỉ còn tối đa ${item.stock} sản phẩm trong kho`, 'warning');
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
          <button onClick={() => navigate('/products')} className="btn-continue-shopping">
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
            <div
              key={`${getItemKey(item)}-${item.selectedSize}-${item.selectedColor}`}
              className="cart-item"
            >
              <div className="col-product">
                {/* ✅ FIX 1: Nhiều fallback ảnh + onError */}
                <img
                  src={item.mainImageUrl || item.image || item.imageUrl || '/placeholder.jpg'}
                  alt={item.name || 'Sản phẩm'}
                  className="item-image"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = '/placeholder.jpg';
                  }}
                />
                <div className="item-details">
                  <h3>{item.name || 'Sản phẩm'}</h3>
                  {item.selectedSize && <p>Kích thước: {item.selectedSize}</p>}
                  {item.selectedColor && <p>Màu: {item.selectedColor}</p>}
                </div>
              </div>

              <div className="col-price">
                {(item.price ?? 0).toLocaleString('vi-VN')} VNĐ
              </div>

              <div className="col-quantity">
                <button onClick={() => handleDecreaseQty(item)} className="qty-btn">
                  −
                </button>
                {/* ✅ FIX 2: fallback quantity về 1 nếu undefined */}
                <input
                  type="number"
                  value={item.quantity ?? 1}
                  readOnly
                />
                <button onClick={() => handleIncreaseQty(item)} className="qty-btn">
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

          {activeCoupon && discount > 0 && (
            <div className="summary-row discount">
              <span>Giảm giá ({activeCoupon.discountPercent}%):</span>
              <span>-{(discount ?? 0).toLocaleString('vi-VN')} VNĐ</span>
            </div>
          )}

          {/* ✅ FIX 3: Hiển thị "Tính khi thanh toán" thay vì tính luôn */}
          <div className="summary-row">
            <span>Phí vận chuyển:</span>
            <span style={{ color: '#888', fontStyle: 'italic', fontSize: 13 }}>
              Tính khi thanh toán
            </span>
          </div>

          <div className="summary-row total">
            <span>Tổng cộng:</span>
            <span>{(total ?? 0).toLocaleString('vi-VN')} VNĐ</span>
          </div>

          <button onClick={handleCheckout} className="btn-checkout">
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

      {/* Modal xác nhận xóa */}
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