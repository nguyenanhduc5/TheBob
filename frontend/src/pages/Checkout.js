import { useState, useEffect, useMemo, useCallback } from 'react';
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
      window.atob(base64).split('').map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
    );
    const payload = JSON.parse(jsonPayload);
    return {
      name: payload.name || payload.unique_name || payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] || '',
      email: payload.email || payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] || '',
      phone: payload.phone || payload.phoneNumber || payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/mobilephone'] || '',
    };
  } catch { return null; }
};

// ── Gọi GHN qua backend để tránh expose token ──
const GHN_BASE = '/api/ghn';

export default function Checkout() {
  const navigate = useNavigate();
  const { cartItems, clearCart } = useCart();
  const { user, token } = useAuth();
  const { addNotification } = useNotification();

  const phoneRegex = /^(0(3|5|7|8|9)\d{8}|\+84(3|5|7|8|9)\d{8})$/;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const [formData, setFormData] = useState({
    fullName: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    specificAddress: '',
    paymentMethod: 'cod',
  });

  // GHN state — lưu cả id lẫn name riêng
  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [wards, setWards] = useState([]);

  const [selectedProvince, setSelectedProvince] = useState({ id: null, name: '' });
  const [selectedDistrict, setSelectedDistrict] = useState({ id: null, name: '' });
  const [selectedWard, setSelectedWard] = useState({ code: '', name: '' });

  const [shippingFee, setShippingFee] = useState(null); // null = chưa tính
  const [isCalcFee, setIsCalcFee] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // ── Auto-fill profile ──
  useEffect(() => {
    const autoFill = async () => {
      const savedToken = token || localStorage.getItem('thebob-token');
      if (!savedToken) return;
      const decoded = decodeJwt(savedToken);
      if (decoded) {
        setFormData(prev => ({
          ...prev,
          fullName: prev.fullName || decoded.name || '',
          email: prev.email || decoded.email || '',
          phone: prev.phone || decoded.phone || '',
        }));
      }
      try {
        const result = await authAPI.getProfile();
        const profile = result?.data || result;
        if (profile) {
          setFormData(prev => ({
            ...prev,
            fullName: profile.name || profile.fullName || prev.fullName,
            email: profile.email || prev.email,
            phone: profile.phone || prev.phone,
          }));
        }
      } catch {}
    };
    autoFill();
  }, [token]);

  // ── Load tỉnh/thành từ GHN (qua backend) ──
  useEffect(() => {
    fetch(`${GHN_BASE}/provinces`)
      .then(r => r.json())
      .then(d => setProvinces(d.data || []))
      .catch(() => addNotification('Không tải được danh sách tỉnh/thành', 'error'));
  }, [addNotification]);

  // ── Tính phí ship khi đủ district + ward ──
  const calcShippingFee = useCallback(async (districtId, wardCode) => {
    if (!districtId || !wardCode) return;
    setIsCalcFee(true);
    try {
      const subtotal = cartItems.reduce((s, i) => s + i.price * i.quantity, 0);
      const totalWeight = cartItems.reduce((s, i) => s + i.quantity * 500, 0);
      const res = await fetch(`${GHN_BASE}/fee`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toDistrictId: districtId,
          toWardCode: wardCode,
          weight: totalWeight,
          insuranceValue: Math.round(subtotal),
          serviceTypeId: 2,
        }),
      });
      const d = await res.json();
      const fee = d.data?.total ?? d.data?.Total ?? null;
      setShippingFee(fee);
    } catch {
      setShippingFee(null);
    } finally {
      setIsCalcFee(false);
    }
  }, [cartItems]);

  // ── Handlers địa chỉ ──
  const handleProvinceChange = async (e) => {
    const id = parseInt(e.target.value);
    const prov = provinces.find(p => p.ProvinceID === id);
    setSelectedProvince({ id: id || null, name: prov?.ProvinceName || '' });
    setSelectedDistrict({ id: null, name: '' });
    setSelectedWard({ code: '', name: '' });
    setDistricts([]);
    setWards([]);
    setShippingFee(null);
    if (!id) return;
    try {
      const res = await fetch(`${GHN_BASE}/districts/${id}`);
      const d = await res.json();
      setDistricts(d.data || []);
    } catch {
      addNotification('Không tải được danh sách quận/huyện', 'error');
    }
  };

  const handleDistrictChange = async (e) => {
    const id = parseInt(e.target.value);
    const dist = districts.find(d => d.DistrictID === id);
    setSelectedDistrict({ id: id || null, name: dist?.DistrictName || '' });
    setSelectedWard({ code: '', name: '' });
    setWards([]);
    setShippingFee(null);
    if (!id) return;
    try {
      const res = await fetch(`${GHN_BASE}/wards/${id}`);
      const d = await res.json();
      setWards(d.data || []);
    } catch {
      addNotification('Không tải được danh sách phường/xã', 'error');
    }
  };

  const handleWardChange = async (e) => {
    const code = e.target.value;
    const ward = wards.find(w => w.WardCode === code);
    setSelectedWard({ code, name: ward?.WardName || '' });
    await calcShippingFee(selectedDistrict.id, code);
  };

  const fullShippingAddress = useMemo(() => {
    return [
      formData.specificAddress,
      selectedWard.name,
      selectedDistrict.name,
      selectedProvince.name,
    ].filter(Boolean).join(', ');
  }, [formData.specificAddress, selectedWard, selectedDistrict, selectedProvince]);

  const handleInputChange = (field) => (e) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.fullName.trim()) errors.fullName = 'Họ tên là bắt buộc';
    if (!emailRegex.test(formData.email.trim())) errors.email = 'Email không hợp lệ';
    if (!phoneRegex.test(formData.phone.trim())) errors.phone = 'SĐT phải là số Việt Nam hợp lệ';
    if (!selectedProvince.id) errors.provinceCity = 'Vui lòng chọn tỉnh/thành';
    if (!selectedDistrict.id) errors.district = 'Vui lòng chọn quận/huyện';
    if (!selectedWard.code) errors.ward = 'Vui lòng chọn phường/xã';
    if (!formData.specificAddress.trim()) errors.specificAddress = 'Vui lòng nhập số nhà, tên đường';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

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
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
        // Tên text để lưu ShippingAddress
        provinceCity: selectedProvince.name,
        district: selectedDistrict.name,
        ward: selectedWard.name,
        specificAddress: formData.specificAddress.trim(),
        paymentMethod: formData.paymentMethod,
        // GHN IDs — backend dùng để tạo đơn thật
        ghnProvinceId: selectedProvince.id,
        ghnDistrictId: selectedDistrict.id,
        ghnWardCode: selectedWard.code,
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
          <button onClick={() => navigate('/products')} className="btn-back-shopping">Quay lại mua sắm</button>
        </div>
      </div>
    );
  }

  const subtotal = cartItems.reduce((total, item) => total + item.price * item.quantity, 0);
  // Dùng phí từ GHN nếu đã tính, fallback 30000
  const shipping = shippingFee !== null ? shippingFee : (selectedWard.code ? null : 30000);
  const total = subtotal + (shipping ?? 0);

  return (
    <div className="checkout-page">
      <h1>Thanh Toán</h1>
      <div className="checkout-container">
        <div className="checkout-form-section">
          <form onSubmit={handleSubmitOrder} className="checkout-form">

            <div className="form-section">
              <h2>Thông Tin Giao Hàng</h2>

              <div className="form-group">
                <label>Họ và Tên *</label>
                <input type="text" value={formData.fullName} onChange={handleInputChange('fullName')} placeholder="Nguyễn Anh Đức" required />
                {formErrors.fullName && <span className="field-error">{formErrors.fullName}</span>}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Email *</label>
                  <input type="email" value={formData.email} onChange={handleInputChange('email')} placeholder="email@example.com" required />
                  {formErrors.email && <span className="field-error">{formErrors.email}</span>}
                </div>
                <div className="form-group">
                  <label>Số Điện Thoại *</label>
                  <input type="tel" inputMode="numeric" value={formData.phone} onChange={handleInputChange('phone')} placeholder="0908474355" required />
                  {formErrors.phone && <span className="field-error">{formErrors.phone}</span>}
                </div>
              </div>

              {/* ── Tỉnh/Thành — GHN ── */}
              <div className="form-group">
                <label>Tỉnh / Thành phố *</label>
                <select value={selectedProvince.id || ''} onChange={handleProvinceChange} required>
                  <option value="">Chọn tỉnh/thành</option>
                  {provinces.map(p => (
                    <option key={p.ProvinceID} value={p.ProvinceID}>{p.ProvinceName}</option>
                  ))}
                </select>
                {formErrors.provinceCity && <span className="field-error">{formErrors.provinceCity}</span>}
              </div>

              <div className="form-row">
                {/* ── Quận/Huyện — GHN ── */}
                <div className="form-group">
                  <label>Quận / Huyện *</label>
                  <select value={selectedDistrict.id || ''} onChange={handleDistrictChange} required disabled={!districts.length}>
                    <option value="">Chọn quận/huyện</option>
                    {districts.map(d => (
                      <option key={d.DistrictID} value={d.DistrictID}>{d.DistrictName}</option>
                    ))}
                  </select>
                  {formErrors.district && <span className="field-error">{formErrors.district}</span>}
                </div>

                {/* ── Phường/Xã — GHN ── */}
                <div className="form-group">
                  <label>Phường / Xã *</label>
                  <select value={selectedWard.code || ''} onChange={handleWardChange} required disabled={!wards.length}>
                    <option value="">Chọn phường/xã</option>
                    {wards.map(w => (
                      <option key={w.WardCode} value={w.WardCode}>{w.WardName}</option>
                    ))}
                  </select>
                  {formErrors.ward && <span className="field-error">{formErrors.ward}</span>}
                </div>
              </div>

              <div className="form-group">
                <label>Số nhà, tên đường *</label>
                <input type="text" value={formData.specificAddress} onChange={handleInputChange('specificAddress')} placeholder="76 Nguyễn Sơn" required />
                {formErrors.specificAddress && <span className="field-error">{formErrors.specificAddress}</span>}
              </div>

              <div className="address-preview">
                <strong>Địa chỉ đầy đủ:</strong> {fullShippingAddress || 'Chưa hoàn tất địa chỉ'}
              </div>
            </div>

            {/* Phương thức thanh toán */}
            <div className="form-section">
              <h2>Phương Thức Thanh Toán</h2>
              <div className="payment-options">
                <label className="payment-option" htmlFor="payment-cod">
                  <input type="radio" id="payment-cod" name="paymentMethod" value="cod" checked={formData.paymentMethod === 'cod'} onChange={handleInputChange('paymentMethod')} />
                  <span className="payment-label">
                    <span className="payment-title">Thanh Toán Khi Nhận Hàng (COD)</span>
                    <span className="payment-description">Trả tiền khi nhận hàng</span>
                  </span>
                </label>
                <label className="payment-option" htmlFor="payment-bank">
                  <input type="radio" id="payment-bank" name="paymentMethod" value="bank_transfer" checked={formData.paymentMethod === 'bank_transfer'} onChange={handleInputChange('paymentMethod')} />
                  <span className="payment-label">
                    <span className="payment-title">Chuyển Khoản QR Banking</span>
                    <span className="payment-description">Chuyển tiền vào tài khoản</span>
                  </span>
                </label>
                <label className="payment-option" htmlFor="payment-qr">
                  <input type="radio" id="payment-qr" name="paymentMethod" value="qr" checked={formData.paymentMethod === 'qr'} onChange={handleInputChange('paymentMethod')} />
                  <span className="payment-label">
                    <span className="payment-title">Thanh Toán Bằng QR Code</span>
                    <span className="payment-description">Quét mã QR Code chuyển khoản</span>
                  </span>
                </label>
              </div>
            </div>

            <div className="form-actions">
              <button type="button" onClick={() => navigate('/cart')} className="btn-back">Quay Lại Giỏ Hàng</button>
              <button type="submit" disabled={isProcessing || isCalcFee} className="btn-place-order">
                {isProcessing ? 'Đang xử lý...' : isCalcFee ? 'Đang tính phí ship...' : 'Đặt Hàng'}
              </button>
            </div>
          </form>
        </div>

        {/* Order Summary */}
        <div className="order-summary-section">
          <div className="order-summary">
            <h2>Tóm Tắt Đơn Hàng</h2>
            <div className="summary-items">
              {cartItems.map(item => (
                <div key={`${item.id}-${item.selectedSize}`} className="summary-item">
                  <div className="item-name">
                    <span>{item.name}</span>
                    <span className="item-quantity">x{item.quantity}</span>
                  </div>
                  <span className="item-total">{(item.price * item.quantity).toLocaleString('vi-VN')} VNĐ</span>
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
              <span>
                {isCalcFee
                  ? 'Đang tính...'
                  : shipping === null
                    ? 'Chọn địa chỉ để tính'
                    : shipping === 0
                      ? 'Miễn Phí'
                      : shipping.toLocaleString('vi-VN') + ' VNĐ'}
              </span>
            </div>
            <div className="summary-row total">
              <span>Tổng Cộng:</span>
              <span>
                {shipping === null
                  ? '---'
                  : total.toLocaleString('vi-VN') + ' VNĐ'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}