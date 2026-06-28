import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useNotification } from '../context/NotificationContext';
import { couponsAPI, cartAPI } from '../api/app';
import '../styles/Cart.css';
 
export default function Cart() {
  const navigate = useNavigate();
  const { cartItems, removeFromCart, updateQuantity, clearCart, loadDbCart } = useCart();
  const { addNotification } = useNotification();
  const [appliedCoupon, setAppliedCoupon] = useState('');
  const [activeCoupon, setActiveCoupon] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [itemToRemove, setItemToRemove] = useState(null);
  const [stockInfo, setStockInfo] = useState({});
  const [isSyncing, setIsSyncing] = useState(false);
 
  // ✅ 1. getItemKey PHẢI Ở ĐÂY - trước tất cả hàm khác
  const getItemKey = (item) => item.variantId ?? item.id;
 
  // ✅ 2. Các hàm dùng getItemKey
  const isItemOutOfStock = (item) => {
    const key = getItemKey(item);
    const info = stockInfo[key];
    if (!info) return false;
    return info.isOutOfStock;
  };
 
  const getAvailableStock = (item) => {
    const key = getItemKey(item);
    const info = stockInfo[key];
    return info?.availableStock ?? item.stock ?? 99;
  };
 
  const hasOutOfStockItems = cartItems.some(item => isItemOutOfStock(item));
 
  // ✅ 3. syncStockInfo trước useEffect vì useEffect gọi nó
  const syncStockInfo = async () => {
    setIsSyncing(true);
    try {
      const response = await cartAPI.sync({
        items: cartItems.map(item => ({
          variantId: getItemKey(item),
          quantity: item.quantity
        }))
      });
 
      if (response.stockInfo) {
        const stockMap = {};
        response.stockInfo.forEach(s => {
          stockMap[s.variantId] = {
            availableStock: s.availableStock,
            isOutOfStock: s.isOutOfStock
          };
        });
        setStockInfo(stockMap);
      }
 
      if (response.hasWarnings && response.warnings) {
        response.warnings.forEach(warning => {
          if (warning.type === 'OUT_OF_STOCK') {
            addNotification(`❌ ${warning.message}`, 'error');
          } else if (warning.type === 'INSUFFICIENT_STOCK') {
            addNotification(`⚠️ ${warning.message}`, 'warning');
          }
        });
      }
    } catch (error) {
      console.error('Sync stock error:', error);
    } finally {
      setIsSyncing(false);
    }
  };
 
  // ✅ 4. useEffect sau syncStockInfo
  useEffect(() => {
    if (loadDbCart) {
      loadDbCart();
    }
  }, [loadDbCart]);
 
  useEffect(() => {
    if (cartItems.length === 0) return;
    syncStockInfo();
  }, [cartItems.length]);
 
  // ✅ 5. Các hàm tính toán
  const calculateSubtotal = () => {
    return cartItems.reduce((total, item) => {
      if (isItemOutOfStock(item)) return total;
      return total + ((item.price ?? 0) * (item.quantity ?? 1));
    }, 0);
  };
 
  const subtotal = calculateSubtotal();
 
  const calculateDiscount = () => {
    if (!activeCoupon) return 0;
    if (activeCoupon.productId) {
      const targetItems = cartItems.filter(item =>
        !isItemOutOfStock(item) && (
          String(item.productId) === String(activeCoupon.productId) ||
          String(item.id) === String(activeCoupon.productId)
        )
      );
      const targetSubtotal = targetItems.reduce(
        (t, i) => t + ((i.price ?? 0) * (i.quantity ?? 1)), 0
      );
      return (targetSubtotal * activeCoupon.discountPercent) / 100;
    }
    return (subtotal * activeCoupon.discountPercent) / 100;
  };
 
  const discount = calculateDiscount();
  const shipping = subtotal > 500000 ? 0 : 30000;
  const total = subtotal - discount + shipping;
 
  // ✅ 6. Các handler
  const handleApplyCoupon = async () => {
    if (!appliedCoupon.trim()) return;
    try {
      const coupon = await couponsAPI.getByCode(
        appliedCoupon.trim().toUpperCase()
      );
      if (coupon && coupon.discountPercent) {
        if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) {
          addNotification('Mã giảm giá này đã hết hạn', 'warning');
          return;
        }
        setActiveCoupon(coupon);
        addNotification(
          `Áp dụng mã ${coupon.code} thành công! Giảm ${coupon.discountPercent}%`,
          'success'
        );
      } else {
        addNotification('Mã giảm giá không tồn tại', 'error');
      }
    } catch (error) {
      addNotification('Mã giảm giá không hợp lệ hoặc đã hết lượt dùng', 'error');
    }
    setAppliedCoupon('');
  };
 
  const handleIncreaseQty = (item) => {
    const available = getAvailableStock(item);
    if (item.quantity + 1 > available) {
      addNotification(
        `Sản phẩm này chỉ còn tối đa ${available} sản phẩm trong kho`,
        'warning'
      );
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
    if (hasOutOfStockItems) {
      addNotification(
        'Vui lòng xóa sản phẩm hết hàng trước khi thanh toán',
        'error'
      );
      return;
    }
    navigate('/checkout');
  };
 
  // ✅ 7. Early return khi giỏ trống
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
 
  // ✅ 8. Main render
  return (
    <div className="cart-page">
      <h1>Giỏ Hàng</h1>
 
      {hasOutOfStockItems && (
        <div className="out-of-stock-banner">
          ❌ Giỏ hàng có sản phẩm đã hết hàng.
          Vui lòng xóa trước khi thanh toán.
        </div>
      )}
 
      {isSyncing && (
        <div className="syncing-banner">
          🔄 Đang kiểm tra tồn kho...
        </div>
      )}
 
      <div className="cart-container">
        <div className="cart-items-section">
          <div className="cart-items-header">
            <span className="col-product">Sản Phẩm</span>
            <span className="col-price">Giá</span>
            <span className="col-quantity">Số Lượng</span>
            <span className="col-subtotal">Thành Tiền</span>
            <span className="col-action">Thao Tác</span>
          </div>
 
          {cartItems.map((item) => {
            const outOfStock = isItemOutOfStock(item);
            const available = getAvailableStock(item);
            const hasStockIssue = !outOfStock && item.quantity > available;
 
            return (
              <div
                key={`${getItemKey(item)}-${item.selectedSize}-${item.selectedColor}`}
                className="cart-item"
                style={{ opacity: outOfStock ? 0.5 : 1 }}
              >
                <div className="col-product">
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <img
                      src={item.mainImageUrl || '/placeholder.jpg'}
                      alt={item.name}
                      className="item-image"
                      style={{ filter: outOfStock ? 'grayscale(100%)' : 'none' }}
                    />
                    {outOfStock && (
                      <div className="sold-out-overlay">HẾT HÀNG</div>
                    )}
                  </div>
                  <div className="item-details">
                    <h3>{item.name}</h3>
                    {item.selectedSize && <p>Kích thước: {item.selectedSize}</p>}
                    {item.selectedColor && <p>Màu: {item.selectedColor}</p>}
                    {outOfStock && (
                      <p className="stock-error">❌ Sản phẩm đã hết hàng</p>
                    )}
                    {hasStockIssue && (
                      <p className="stock-warning">⚠️ Chỉ còn {available} sản phẩm</p>
                    )}
                  </div>
                </div>
 
                <div className="col-price">
                  {(item.price ?? 0).toLocaleString('vi-VN')} VNĐ
                </div>
 
                <div className="col-quantity">
                  <button
                    onClick={() => handleDecreaseQty(item)}
                    className="qty-btn"
                    disabled={outOfStock}
                  >−</button>
                  <input type="number" value={item.quantity} readOnly />
                  <button
                    onClick={() => handleIncreaseQty(item)}
                    className="qty-btn"
                    disabled={outOfStock || item.quantity >= available}
                  >+</button>
                </div>
 
                <div className="col-subtotal">
                  {outOfStock
                    ? <span style={{ color: 'red', fontSize: 12 }}>Hết hàng</span>
                    : `${((item.price ?? 0) * (item.quantity ?? 1)).toLocaleString('vi-VN')} VNĐ`
                  }
                </div>
 
                <div className="col-action">
                  <button
                    onClick={() => handleRemoveItem(getItemKey(item))}
                    className="btn-remove"
                  >✕</button>
                </div>
              </div>
            );
          })}
        </div>
 
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
 
          <div className="summary-row">
            <span>Phí vận chuyển:</span>
            <span>
              {shipping === 0
                ? 'Miễn Phí'
                : `${(shipping ?? 0).toLocaleString('vi-VN')} VNĐ`}
            </span>
          </div>
 
          <div className="summary-row total">
            <span>Tổng cộng:</span>
            <span>{(total ?? 0).toLocaleString('vi-VN')} VNĐ</span>
          </div>
 
          <button
            onClick={handleCheckout}
            className="btn-checkout"
            disabled={hasOutOfStockItems || isSyncing}
            style={{
              backgroundColor: hasOutOfStockItems ? '#ccc' : '',
              cursor: hasOutOfStockItems ? 'not-allowed' : 'pointer'
            }}
            title={hasOutOfStockItems ? 'Xóa sản phẩm hết hàng trước khi thanh toán' : ''}
          >
            {isSyncing
              ? '⏳ Đang kiểm tra...'
              : hasOutOfStockItems
                ? '❌ Có sản phẩm hết hàng'
                : 'Tiến Hành Thanh Toán'
            }
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
              >Hủy</button>
              <button
                className="confirm-modal-btn btn-confirm"
                onClick={() => {
                  removeFromCart(itemToRemove);
                  addNotification('Đã xóa sản phẩm khỏi giỏ hàng', 'info');
                  setShowConfirmModal(false);
                  setItemToRemove(null);
                }}
              >Đồng ý</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}