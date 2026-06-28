import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { authAPI, cartAPI, ordersAPI } from '../api/app';
import { shippingAPI } from '../api/shipping';
import '../styles/Checkout.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const decodeJwt = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window.atob(base64).split('').map((c) =>
        '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      ).join('')
    );
    const p = JSON.parse(jsonPayload);
    return {
      name:  p.name  || p.unique_name || p['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] || '',
      email: p.email || p['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] || '',
      phone: p.phone || p.phoneNumber || p['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/mobilephone'] || '',
    };
  } catch {
    return null;
  }
};

const phoneRegex = /^(0(3|5|7|8|9)\d{8}|\+84(3|5|7|8|9)\d{8})$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const fmt = (n) => Number(n || 0).toLocaleString('vi-VN');

// ─── Component ────────────────────────────────────────────────────────────────

export default function Checkout() {
  const navigate          = useNavigate();
  const { cartItems, clearCart, loadDbCart } = useCart();
  const { user, token }   = useAuth();
  const { addNotification } = useNotification();

  // Form
  const [formData, setFormData] = useState({
    fullName:        user?.name  || '',
    email:           user?.email || '',
    phone:           user?.phone || '',
    specificAddress: '',
    paymentMethod:   'cod',
  });
  const [formErrors, setFormErrors] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);

  // GHN address
  const [provinces,  setProvinces]  = useState([]);
  const [districts,  setDistricts]  = useState([]);
  const [wards,      setWards]      = useState([]);

  const [selectedProvince, setSelectedProvince] = useState(null); // { provinceId, provinceName }
  const [selectedDistrict, setSelectedDistrict] = useState(null); // { districtId, districtName }
  const [selectedWard,     setSelectedWard]     = useState(null); // { wardCode, wardName }

  // Shipping fee
  const [shippingFee,        setShippingFee]        = useState(null);  // null = chưa tính
  const [shippingFeeLoading, setShippingFeeLoading] = useState(false);
  const [shippingFeeError,   setShippingFeeError]   = useState(null);

  const feeDebounceRef = useRef(null);

  // ── Auto-fill profile ──────────────────────────────────────────────────────

  useEffect(() => {
    const fill = async () => {
      const t = token || localStorage.getItem('thebob-token');
      if (!t) return;

      const decoded = decodeJwt(t);
      if (decoded) {
        setFormData(prev => ({
          ...prev,
          fullName: prev.fullName || decoded.name  || '',
          email:    prev.email    || decoded.email || '',
          phone:    prev.phone    || decoded.phone || '',
        }));
      }

      try {
        const res     = await authAPI.getProfile();
        const profile = res?.data || res;
        if (profile) {
          setFormData(prev => ({
            ...prev,
            fullName: profile.name     || profile.fullName || prev.fullName,
            email:    profile.email    || prev.email,
            phone:    profile.phone    || prev.phone,
          }));
        }
      } catch (err) {
        console.error('Failed to fetch profile:', err);
      }
    };
    fill();
  }, [token]);

  // ── Load provinces từ GHN ─────────────────────────────────────────────────

  useEffect(() => {
    shippingAPI.getProvinces()
      .then(setProvinces)
      .catch(() => addNotification('Không tải được danh sách tỉnh/thành', 'error'));
  }, [addNotification]);

  // ── Tính phí ship khi chọn đủ phường + có sản phẩm ──────────────────────

  const calculateFee = useCallback(async (districtId, wardCode) => {
    if (!districtId || !wardCode) return;

    clearTimeout(feeDebounceRef.current);
    feeDebounceRef.current = setTimeout(async () => {
      setShippingFeeLoading(true);
      setShippingFeeError(null);
      try {
        const totalWeight = cartItems.reduce((sum, item) => sum + (item.quantity * 500), 0); // 500g/sản phẩm
        const insuranceValue = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        const result = await shippingAPI.calculateFee({
          toDistrictId:   districtId,
          toWardCode:     wardCode,
          weight:         Math.max(totalWeight, 200), // tối thiểu 200g
          length:         20,
          width:          15,
          height:         10,
          insuranceValue: insuranceValue,
        });

        setShippingFee(result.total ?? result.Total ?? 0);
      } catch (err) {
        console.error('Fee calculation failed:', err);
        setShippingFeeError('Không tính được phí ship, dùng mặc định 30.000đ');
        setShippingFee(30000); // fallback
      } finally {
        setShippingFeeLoading(false);
      }
    }, 400);
  }, [cartItems]);

  // ── Address handlers ───────────────────────────────────────────────────────

  const handleProvinceChange = async (e) => {
    const id = parseInt(e.target.value);
    const province = provinces.find(p => p.provinceId === id) || null;

    setSelectedProvince(province);
    setSelectedDistrict(null);
    setSelectedWard(null);
    setDistricts([]);
    setWards([]);
    setShippingFee(null);

    if (!province) return;

    try {
      const data = await shippingAPI.getDistricts(province.provinceId);
      setDistricts(data);
    } catch {
      addNotification('Không tải được danh sách quận/huyện', 'error');
    }
  };

  const handleDistrictChange = async (e) => {
    const id = parseInt(e.target.value);
    const district = districts.find(d => d.districtId === id) || null;

    setSelectedDistrict(district);
    setSelectedWard(null);
    setWards([]);
    setShippingFee(null);

    if (!district) return;

    try {
      const data = await shippingAPI.getWards(district.districtId);
      setWards(data);
    } catch {
      addNotification('Không tải được danh sách phường/xã', 'error');
    }
  };

  const handleWardChange = (e) => {
    const code = e.target.value;
    const ward = wards.find(w => w.wardCode === code) || null;
    setSelectedWard(ward);

    if (ward && selectedDistrict) {
      calculateFee(selectedDistrict.districtId, ward.wardCode);
    }
  };

  // ── Địa chỉ đầy đủ ────────────────────────────────────────────────────────

  const fullShippingAddress = useMemo(() => {
    return [
      formData.specificAddress,
      selectedWard?.wardName,
      selectedDistrict?.districtName,
      selectedProvince?.provinceName,
    ].filter(Boolean).join(', ');
  }, [formData.specificAddress, selectedWard, selectedDistrict, selectedProvince]);

  // ── Tính tổng tiền ────────────────────────────────────────────────────────

  const subtotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cartItems]
  );

  // Ưu tiên: phí GHN thật → fallback 30k → miễn phí nếu subtotal > 500k
  const shipping = useMemo(() => {
    if (subtotal > 500000) return 0;
    return shippingFee ?? 30000;
  }, [subtotal, shippingFee]);

  const total = subtotal + shipping;

  // ── Validate ──────────────────────────────────────────────────────────────

  const validateForm = () => {
    const errors = {};
    if (!formData.fullName.trim())               errors.fullName        = 'Họ tên là bắt buộc';
    if (!emailRegex.test(formData.email.trim())) errors.email           = 'Email không hợp lệ';
    if (!phoneRegex.test(formData.phone.trim())) errors.phone           = 'SĐT phải là số Việt Nam hợp lệ';
    if (!selectedProvince)                        errors.provinceCity    = 'Vui lòng chọn tỉnh/thành';
    if (!selectedDistrict)                        errors.district        = 'Vui lòng chọn quận/huyện';
    if (!selectedWard)                            errors.ward            = 'Vui lòng chọn phường/xã';
    if (!formData.specificAddress.trim())         errors.specificAddress = 'Vui lòng nhập số nhà, tên đường';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      addNotification('Vui lòng kiểm tra lại thông tin giao hàng', 'warning');
      return;
    }

    setIsProcessing(true);
    try {
      const invalidItem = cartItems.find(item => !item.variantId);
      if (invalidItem) {
        addNotification('Giỏ hàng có sản phẩm chưa chọn biến thể, vui lòng thêm lại.', 'error');
        return;
      }

      await cartAPI.syncCart(
        cartItems.map(item => ({ variantId: item.variantId, quantity: item.quantity }))
      );

      const orderData = {
        email:           formData.email.trim().toLowerCase(),
        phone:           formData.phone.trim(),
        fullName:        formData.fullName.trim(),
        specificAddress: formData.specificAddress.trim(),
        shippingAddress: fullShippingAddress,
        paymentMethod:   formData.paymentMethod,

        // Tên địa chỉ (hiển thị)
        provinceCity:    selectedProvince?.provinceName || '',
        district:        selectedDistrict?.districtName || '',
        ward:            selectedWard?.wardName         || '',

        // GHN codes (để tạo đơn vận chuyển sau)
        toDistrictId:    selectedDistrict?.districtId  ?? 0,
        toWardCode:      selectedWard?.wardCode        ?? '',

        // Phí ship đã tính
        shippingFee:     shipping,
      };

      const order = await ordersAPI.createOrder(orderData);

      if (order) {
        addNotification('Đặt hàng thành công! Cảm ơn bạn đã mua sắm.', 'success');

        if (formData.paymentMethod === 'cod') clearCart();

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

      // Handle checkout stock changes
      if (error?.payload?.stockInfo) {
        addNotification(error.payload.message || 'Một số sản phẩm trong giỏ hàng đã thay đổi tồn kho. Vui lòng cập nhật lại giỏ hàng.', 'error');
        if (loadDbCart) {
          await loadDbCart();
        }
        navigate('/cart');
        return;
      }

      addNotification(error?.message || 'Lỗi khi xử lý đơn hàng', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Empty cart ────────────────────────────────────────────────────────────

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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="checkout-page">
      <h1>Thanh Toán</h1>

      <div className="checkout-container">
        {/* ── Form ── */}
        <div className="checkout-form-section">
          <form onSubmit={handleSubmitOrder} className="checkout-form">

            {/* Thông tin giao hàng */}
            <div className="form-section">
              <h2>Thông Tin Giao Hàng</h2>

              <div className="form-group">
                <label>Họ và Tên *</label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={e => setFormData(p => ({ ...p, fullName: e.target.value }))}
                  placeholder="Nguyễn Anh Đức"
                  required
                />
                {formErrors.fullName && <span className="field-error">{formErrors.fullName}</span>}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Email *</label>
                  <input
                    type="email"
                    inputMode="email"
                    value={formData.email}
                    onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                    placeholder="email@example.com"
                    required
                  />
                  {formErrors.email && <span className="field-error">{formErrors.email}</span>}
                </div>
                <div className="form-group">
                  <label>Số Điện Thoại *</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={formData.phone}
                    onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                    placeholder="0908474355"
                    required
                  />
                  {formErrors.phone && <span className="field-error">{formErrors.phone}</span>}
                </div>
              </div>

              {/* Tỉnh/Thành */}
              <div className="form-group">
                <label>Tỉnh / Thành phố *</label>
                <select
                  value={selectedProvince?.provinceId || ''}
                  onChange={handleProvinceChange}
                  required
                >
                  <option value="">Chọn tỉnh/thành</option>
                  {provinces.map(p => (
                    <option key={p.provinceId} value={p.provinceId}>{p.provinceName}</option>
                  ))}
                </select>
                {formErrors.provinceCity && <span className="field-error">{formErrors.provinceCity}</span>}
              </div>

              <div className="form-row">
                {/* Quận/Huyện */}
                <div className="form-group">
                  <label>Quận / Huyện *</label>
                  <select
                    value={selectedDistrict?.districtId || ''}
                    onChange={handleDistrictChange}
                    required
                    disabled={!districts.length}
                  >
                    <option value="">Chọn quận/huyện</option>
                    {districts.map(d => (
                      <option key={d.districtId} value={d.districtId}>{d.districtName}</option>
                    ))}
                  </select>
                  {formErrors.district && <span className="field-error">{formErrors.district}</span>}
                </div>

                {/* Phường/Xã */}
                <div className="form-group">
                  <label>Phường / Xã *</label>
                  <select
                    value={selectedWard?.wardCode || ''}
                    onChange={handleWardChange}
                    required
                    disabled={!wards.length}
                  >
                    <option value="">Chọn phường/xã</option>
                    {wards.map(w => (
                      <option key={w.wardCode} value={w.wardCode}>{w.wardName}</option>
                    ))}
                  </select>
                  {formErrors.ward && <span className="field-error">{formErrors.ward}</span>}
                </div>
              </div>

              {/* Số nhà */}
              <div className="form-group">
                <label>Số nhà, tên đường *</label>
                <input
                  type="text"
                  value={formData.specificAddress}
                  onChange={e => setFormData(p => ({ ...p, specificAddress: e.target.value }))}
                  placeholder="76 Nguyễn Sơn"
                  required
                />
                {formErrors.specificAddress && <span className="field-error">{formErrors.specificAddress}</span>}
              </div>

              {fullShippingAddress && (
                <div className="address-preview">
                  <strong>Địa chỉ đầy đủ:</strong> {fullShippingAddress}
                </div>
              )}
            </div>

            {/* Phương thức thanh toán */}
            <div className="form-section">
              <h2>Phương Thức Thanh Toán</h2>
              <div className="payment-options">
                {[
                  { value: 'cod',           title: 'Thanh Toán Khi Nhận Hàng (COD)', desc: 'Trả tiền khi nhận hàng' },
                  { value: 'bank_transfer', title: 'Chuyển Khoản QR Banking',         desc: 'Chuyển tiền vào tài khoản' },
                  { value: 'qr',            title: 'Thanh Toán Bằng QR Code',         desc: 'Quét mã QR Code chuyển khoản' },
                ].map(opt => (
                  <div className="payment-option" key={opt.value}>
                    <input
                      type="radio"
                      id={`payment-${opt.value}`}
                      name="paymentMethod"
                      value={opt.value}
                      checked={formData.paymentMethod === opt.value}
                      onChange={e => setFormData(p => ({ ...p, paymentMethod: e.target.value }))}
                    />
                    <label htmlFor={`payment-${opt.value}`}>
                      <span className="payment-title">{opt.title}</span>
                      <span className="payment-description">{opt.desc}</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="form-actions">
              <button type="button" onClick={() => navigate('/cart')} className="btn-back">
                Quay Lại Giỏ Hàng
              </button>
              <button type="submit" disabled={isProcessing} className="btn-place-order">
                {isProcessing ? 'Đang xử lý...' : 'Đặt Hàng'}
              </button>
            </div>
          </form>
        </div>

        {/* ── Order Summary ── */}
        <div className="order-summary-section">
          <div className="order-summary">
            <h2>Tóm Tắt Đơn Hàng</h2>

            <div className="summary-items">
              {cartItems.map(item => (
                <div key={`${item.id}-${item.selectedSize}`} className="summary-item">
                  <div className="item-name">
                    <span>{item.name}</span>
                    <span className="item-quantity">×{item.quantity}</span>
                  </div>
                  <span className="item-total">{fmt(item.price * item.quantity)} VNĐ</span>
                </div>
              ))}
            </div>

            <div className="summary-divider" />

            <div className="summary-row">
              <span>Tạm tính:</span>
              <span>{fmt(subtotal)} VNĐ</span>
            </div>

            <div className="summary-row">
              <span>Phí vận chuyển:</span>
              <span>
                {subtotal > 500000
                  ? 'Miễn phí'
                  : shippingFeeLoading
                    ? 'Đang tính…'
                    : shippingFee !== null
                      ? `${fmt(shippingFee)} VNĐ`
                      : selectedWard
                        ? 'Đang tính…'
                        : 'Chọn địa chỉ để tính phí'}
              </span>
            </div>

            {shippingFeeError && (
              <div className="shipping-fee-error">{shippingFeeError}</div>
            )}

            <div className="summary-row total">
              <span>Tổng Cộng:</span>
              <span>{fmt(total)} VNĐ</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
