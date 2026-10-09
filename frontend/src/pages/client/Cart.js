import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { recommendationAPI, promotionsAPI, couponsAPI } from '../../api/app';
import '../../styles/Products.css'; // Reuse product card styles
import { useCart } from '../../context/CartContext';
import { useNotification } from '../../context/NotificationContext';
import { usePreferences } from '../../context/PreferencesContext';
import '../../styles/Cart.css';

export default function Cart() {
  const navigate = useNavigate();
  const { cartItems, removeFromCart, updateQuantity, clearCart } = useCart();
  const { addNotification } = useNotification();
  const { t } = usePreferences();
  const [appliedCoupon, setAppliedCoupon] = useState('');
  const [activeCoupon, setActiveCoupon] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [itemToRemove, setItemToRemove] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [applicablePromotions, setApplicablePromotions] = useState([]);
  const [automaticDiscount, setAutomaticDiscount] = useState(0);
  const [promotionLoading, setPromotionLoading] = useState(false);

  useEffect(() => {
    async function fetchCartRecs() {
      if (cartItems.length === 0) return;
      try {
        const prodIds = cartItems.map(item => item.productId || item.id).filter(Boolean);
        if (prodIds.length > 0) {
          const recs = await recommendationAPI.getFrequentlyBought(prodIds.join(','), 4);
          setRecommendations(recs || []);
        }
      } catch (err) {
        console.error('Failed to fetch cart cross-sell recommendations:', err);
      }
    }
    fetchCartRecs();
  }, [cartItems]);

  // ✅ NEW: Fetch automatic promotions when cart changes
  useEffect(() => {
    async function fetchAndCalculatePromotions() {
      if (cartItems.length === 0) {
        setApplicablePromotions([]);
        setAutomaticDiscount(0);
        return;
      }

      setPromotionLoading(true);
      try {
        // Call new endpoint to calculate promotions (includes automatic discount)
        const calcResult = await promotionsAPI.calculatePromotions();
        
        if (calcResult?.automaticDiscount > 0) {
          setAutomaticDiscount(calcResult.automaticDiscount);
        } else {
          setAutomaticDiscount(0);
        }

        // Also fetch applicable promotions to show user available offers
        const promos = await promotionsAPI.getApplicable();
        setApplicablePromotions(promos || []);
      } catch (err) {
        console.error('Failed to fetch promotions in Cart:', err);
        setAutomaticDiscount(0);
      } finally {
        setPromotionLoading(false);
      }
    }

    fetchAndCalculatePromotions();
  }, [cartItems]);

  const getItemKey = (item) => item.variantId ?? item.id;

  const calculateSubtotal = () => {
    return cartItems.reduce((total, item) => total + ((item.price ?? 0) * (item.quantity ?? 1)), 0);
  };

  const subtotal = calculateSubtotal();

  const calculateDiscount = () => {
    let totalDiscount = automaticDiscount;
    
    if (activeCoupon) {
      if (activeCoupon.productId) {
        const targetItems = cartItems.filter(item =>
          String(item.productId) === String(activeCoupon.productId) ||
          String(item.id) === String(activeCoupon.productId)
        );
        const targetSubtotal = targetItems.reduce((t, i) => t + ((i.price ?? 0) * (i.quantity ?? 1)), 0);
        totalDiscount += (targetSubtotal * activeCoupon.discountPercent) / 100;
      } else {
        totalDiscount += (subtotal * activeCoupon.discountPercent) / 100;
      }
    }
    
    return totalDiscount;
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
          addNotification(t('cart.notification.expiredCoupon'), 'warning');
          return;
        }
        setActiveCoupon(coupon);
        addNotification(
          t('cart.notification.couponApplied')
            .replace('{code}', coupon.code)
            .replace('{percent}', coupon.discountPercent),
          'success'
        );
      } else {
        addNotification(t('cart.notification.couponMissing'), 'error');
      }
    } catch (error) {
      addNotification(t('cart.notification.couponInvalid'), 'error');
    }
    setAppliedCoupon('');
  };

  const handleIncreaseQty = (item) => {
    if (item.quantity + 1 > item.stock) {
      addNotification(t('cart.notification.stock').replace('{stock}', item.stock), 'warning');
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
    addNotification(t('cart.notification.removed'), 'info');
  };

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      addNotification(t('cart.notification.empty'), 'warning');
      return;
    }
    navigate('/checkout');
  };

  if (cartItems.length === 0) {
    return (
      <div className="cart-page">
        <div className="cart-empty">
          <div className="empty-icon">🛒</div>
          <h2>{t('cart.empty.title')}</h2>
          <p>{t('cart.empty.description')}</p>
          <button onClick={() => navigate('/products')} className="btn-continue-shopping">
            {t('cart.continue')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <h1>{t('cart.title')}</h1>

      <div className="cart-container">
        {/* Cart Items */}
        <div className="cart-items-section">
          <div className="cart-items-header">
            <span className="col-product">{t('cart.product')}</span>
            <span className="col-price">{t('cart.price')}</span>
            <span className="col-quantity">{t('cart.quantity')}</span>
            <span className="col-subtotal">{t('cart.subtotal')}</span>
            <span className="col-action">{t('cart.actions')}</span>
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
                  alt={item.name || t('cart.product')}
                  className="item-image"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = '/placeholder.jpg';
                  }}
                />
                <div className="item-details">
                  <h3>{item.name || t('cart.product')}</h3>
                  {item.selectedSize && <p>{t('cart.size')}: {item.selectedSize}</p>}
                  {item.selectedColor && <p>{t('cart.color')}: {item.selectedColor}</p>}
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
          <h2>{t('cart.summary')}</h2>

          <div className="coupon-section">
            <input
              type="text"
              placeholder={t('cart.coupon.placeholder')}
              value={appliedCoupon}
              onChange={(e) => setAppliedCoupon(e.target.value)}
              className="coupon-input"
            />
            <button onClick={handleApplyCoupon} className="btn-apply-coupon">
              {t('cart.coupon.apply')}
            </button>
          </div>

          {/* ✅ NEW: Show applicable promotions */}
          {applicablePromotions.length > 0 && (
            <div className="applicable-promotions" style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f0f8ff', borderRadius: '4px' }}>
              <p style={{ fontSize: '0.85rem', margin: '0 0 5px 0', color: '#555' }}>{t('cart.promotion.auto')}</p>
              {applicablePromotions.map((promo) => (
                <div key={promo.id} style={{ fontSize: '0.8rem', color: '#0066cc', marginBottom: '3px' }}>
                  • {promo.name} ({promo.discountValue}% giảm)
                </div>
              ))}
            </div>
          )}

          {promotionLoading && (
            <div style={{ fontSize: '0.85rem', color: '#999', marginBottom: '10px' }}>
              {t('cart.promotion.loading')}
            </div>
          )}

          <div className="summary-row">
            <span>{t('cart.subtotal.label')}</span>
            <span>{(subtotal ?? 0).toLocaleString('vi-VN')} VNĐ</span>
          </div>

          {activeCoupon && discount > 0 && (
            <div className="summary-row discount">
              <span>{t('cart.discount').replace('{percent}', activeCoupon.discountPercent)}</span>
              <span>-{(discount ?? 0).toLocaleString('vi-VN')} VNĐ</span>
            </div>
          )}

          {/* ✅ FIX 3: Hiển thị "Tính khi thanh toán" thay vì tính luôn */}
          <div className="summary-row">
            <span>{t('cart.shipping')}</span>
            <span style={{ color: '#888', fontStyle: 'italic', fontSize: 13 }}>
              {t('cart.shipping.checkout')}
            </span>
          </div>

          <div className="summary-row total">
            <span>{t('cart.total')}</span>
            <span>{(total ?? 0).toLocaleString('vi-VN')} VNĐ</span>
          </div>

          <button onClick={handleCheckout} className="btn-checkout">
            {t('cart.checkout')}
          </button>

          <button
            onClick={() => navigate('/products')}
            className="btn-continue-shopping-secondary"
          >
            {t('cart.continue.button')}
          </button>

          <button
            onClick={() => {
              clearCart();
              addNotification(t('cart.notification.clear'), 'info');
            }}
            className="btn-clear-cart"
          >
            {t('cart.clear')}
          </button>
        </div>
      </div>

      {/* Cross-selling Recommendations */}
      {recommendations.length > 0 && (
        <div className="recommendations-section-custom" style={{ padding: '60px 5%', borderTop: '1px solid #eee', marginTop: '40px' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 300, letterSpacing: '0.05em', marginBottom: '30px', textAlign: 'center' }}>
            {t('cart.recommendations')}
          </h2>
          <div className="products-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '30px' }}>
            {recommendations.map((item) => (
              <div key={item.id} className="product-card" style={{ border: '1px solid #eee', padding: '15px', background: '#fff' }}>
                <div className="product-image-container" onClick={() => navigate(`/product/${item.slug || item.id}`)} style={{ cursor: 'pointer' }}>
                  <img src={item.mainImageUrl || '/placeholder.jpg'} alt={item.name} className="product-image" style={{ width: '100%', height: '220px', objectFit: 'cover' }} />
                </div>
                <div className="product-info" style={{ marginTop: '15px' }}>
                  <h3 className="product-name" onClick={() => navigate(`/product/${item.slug || item.id}`)} style={{ cursor: 'pointer', fontSize: '1rem', fontWeight: 400, minHeight: '40px' }}>{item.name}</h3>
                  <div className="product-price" style={{ fontWeight: 600, margin: '8px 0', fontSize: '1.1rem' }}>{item.price?.toLocaleString('vi-VN')} VNĐ</div>
                  <button onClick={() => navigate(`/product/${item.slug || item.id}`)} className="btn-add-to-cart" style={{ width: '100%', padding: '12px' }}>{t('product.details')}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal xác nhận xóa */}
      {showConfirmModal && (
        <div className="confirm-modal-overlay">
          <div className="confirm-modal">
            <h3>{t('cart.confirmRemove.title')}</h3>
            <p>{t('cart.confirmRemove.description')}</p>
            <div className="confirm-modal-actions">
              <button
                className="confirm-modal-btn btn-cancel"
                onClick={() => {
                  setShowConfirmModal(false);
                  setItemToRemove(null);
                }}
              >
                {t('cart.cancel')}
              </button>
              <button
                className="confirm-modal-btn btn-confirm"
                onClick={() => {
                  removeFromCart(itemToRemove);
                  addNotification(t('cart.notification.removed'), 'info');
                  setShowConfirmModal(false);
                  setItemToRemove(null);
                }}
              >
                {t('cart.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
