import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { authAPI, cartAPI, ordersAPI } from '../api/app';
import '../styles/Checkout.css';

// ─── Data địa chỉ VN tĩnh ────────────────────────────────────────────────────
// Dùng CDN thay provinces.open-api.vn để tránh lỗi CORS / server down
const VN_ADDRESS_URL =
  'https://raw.githubusercontent.com/kenzouno1/DiaGioiHanhChinhVN/master/data.json';

// ─── Decode JWT ───────────────────────────────────────────────────────────────
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
      name:
        payload.name ||
        payload.unique_name ||
        payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] ||
        '',
      email:
        payload.email ||
        payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] ||
        '',
      phone:
        payload.phone ||
        payload.phoneNumber ||
        payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/mobilephone'] ||
        '',
    };
  } catch {
    return null;
  }
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function Checkout() {
  const navigate = useNavigate();
  const { cartItems, clearCart } = useCart();
  const { user, token } = useAuth();
  const { addNotification } = useNotification();

  const phoneRegex = /^(0(3|5|7|8|9)\d{8}|\+84(3|5|7|8|9)\d{8})$/;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // ── State form ──────────────────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    fullName: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    specificAddress: '',
    provinceCity: '',   // tên tỉnh
    district: '',       // tên quận
    ward: '',           // tên phường
    paymentMethod: 'cod',
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // ── State địa chỉ ───────────────────────────────────────────────────────────
  const [allProvinces, setAllProvinces] = useState([]);   // toàn bộ data JSON
  const [provinces, setProvinces] = useState([]);          // [{Id, Name}]
  const [districts, setDistricts] = useState([]);          // [{Id, Name}]
  const [wards, setWards] = useState([]);                  // [{Id, Name}]
  const [selectedProvinceId, setSelectedProvinceId] = useState('');
  const [selectedDistrictId, setSelectedDistrictId] = useState('');
  const [isLoadingAddress, setIsLoadingAddress] = useState(true);

  // ── Auto-fill profile ───────────────────────────────────────────────────────
  useEffect(() => {
    const autoFillProfile = async () => {
      const savedToken = token || localStorage.getItem('thebob-token');
      if (!savedToken) return;

      const decoded = decodeJwt(savedToken);
      if (decoded) {
        setFormData((prev) => ({
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
          setFormData((prev) => ({
            ...prev,
            fullName: profile.name || profile.fullName || prev.fullName,
            email: profile.email || prev.email,
            phone: profile.phone || prev.phone,
          }));
        }
      } catch (error) {
        console.error('Failed to fetch profile in Checkout:', error);
      }
    };

    autoFillProfile();
  }, [token]);

  // ── Load toàn bộ data địa chỉ VN (1 lần) ──────────────────────────────────
  useEffect(() => {
    const loadAddressData = async () => {
      setIsLoadingAddress(true);
      try {
        const res = await fetch(VN_ADDRESS_URL);
        if (!res.ok) throw new Error('Network error');
        const data = await res.json();
        // data: [{ Id, Name, Districts: [{ Id, Name, Wards: [{ Id, Name }] }] }]
        setAllProvinces(data);
        setProvinces(data.map((p) => ({ Id: p.Id, Name: p.Name })));
      } catch (error) {
        console.error('Failed to load address data:', error);
        addNotification('Không tải được danh sách địa chỉ, vui lòng thử lại', 'error');
      } finally {
        setIsLoadingAddress(false);
      }
    };

    loadAddressData();
  }, [addNotification]);

  // ── Địa chỉ đầy đủ để preview ──────────────────────────────────────────────
  const fullShippingAddress = useMemo(() => {
    return [
      formData.specificAddress,
      formData.ward,
      formData.district,
      formData.provinceCity,
    ]
      .filter(Boolean)
      .join(', ');
  }, [formData.specificAddress, formData.ward, formData.district, formData.provinceCity]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleInputChange = (field) => (e) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleProvinceChange = (e) => {
    const provinceId = e.target.value;
    const province = allProvinces.find((p) => p.Id === provinceId);

    setSelectedProvinceId(provinceId);
    setSelectedDistrictId('');
    setDistricts(province ? province.Districts.map((d) => ({ Id: d.Id, Name: d.Name })) : []);
    setWards([]);

    setFormData((prev) => ({
      ...prev,
      provinceCity: province?.Name || '',
      district: '',
      ward: '',
    }));
  };

  const handleDistrictChange = (e) => {
    const districtId = e.target.value;
    const province = allProvinces.find((p) => p.Id === selectedProvinceId);
    const district = province?.Districts.find((d) => d.Id === districtId);

    setSelectedDistrictId(districtId);
    setWards(district ? district.Wards.map((w) => ({ Id: w.Id, Name: w.Name })) : []);

    setFormData((prev) => ({
      ...prev,
      district: district?.Name || '',
      ward: '',
    }));
  };

  const handleWardChange = (e) => {
    const wardId = e.target.value;
    const ward = wards.find((w) => w.Id === wardId);

    setFormData((prev) => ({
      ...prev,
      ward: ward?.Name || '',
    }));
  };

  // ── Validate ────────────────────────────────────────────────────────────────
  const validateForm = () => {
    const errors = {};

    if (!formData.fullName.trim()) errors.fullName = 'Họ tên là bắt buộc';
    if (!emailRegex.test(formData.email.trim())) errors.email = 'Email không hợp lệ';
    if (!phoneRegex.test(formData.phone.trim())) errors.phone = 'SĐT phải là số Việt Nam hợp lệ';
    if (!formData.provinceCity) errors.provinceCity = 'Vui lòng chọn tỉnh/thành';
    if (!formData.district) errors.district = 'Vui lòng chọn quận/huyện';
    if (!formData.ward) errors.ward = 'Vui lòng chọn phường/xã';
    if (!formData.specificAddress.trim()) errors.specificAddress = 'Vui lòng nhập số nhà, tên đường';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmitOrder = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      addNotification('Vui lòng kiểm tra lại thông tin giao hàng', 'warning');
      return;
    }

    setIsProcessing(true);

    try {
      const invalidItem = cartItems.find((item) => !item.variantId);
      if (invalidItem) {
        addNotification(
          'Giỏ hàng có sản phẩm chưa chọn biến thể, vui lòng thêm lại sản phẩm.',
          'error'
        );
        setIsProcessing(false);
        return;
      }

      await cartAPI.syncCart(
        cartItems.map((item) => ({
          variantId: item.variantId,
          quantity: item.quantity,
        }))
      );

      const orderData = {
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
        provinceCity: formData.provinceCity,
        district: formData.district,
        ward: formData.ward,
        specificAddress: formData.specificAddress.trim(),
        paymentMethod: formData.paymentMethod,
      };

      const order = await ordersAPI.createOrder(orderData);

      if (order) {
        addNotification('Đặt hàng thành công! Cảm ơn bạn đã mua sắm.', 'success');

        if (formData.paymentMethod === 'cod') {
          clearCart();
        }

        setTimeout(() => {
          if (
            formData.paymentMethod === 'bank_transfer' ||
            formData.paymentMethod === 'qr'
          ) {
            navigate(`/payment/${order.id}`);
          } else {
            navigate(`/orders/${order.id}`);
          }
        }, 1000);
      }
    } catch (error) {
      console.error('Order submission error:', error);
      if (error?.status === 409 && error?.payload?.orderId) {
        addNotification(
          error.payload.message || 'Bạn đang có đơn hàng chờ thanh toán',
          'warning'
        );
        navigate(`/payment/${error.payload.orderId}`);
        return;
      }
      addNotification(error?.message || 'Lỗi khi xử lý đơn hàng', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Empty cart ──────────────────────────────────────────────────────────────
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

  // ── Tính tiền ───────────────────────────────────────────────────────────────
  const subtotal = cartItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );
  const shipping = subtotal > 500000 ? 0 : 30000;
  const total = subtotal + shipping;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="checkout-page">
      <h1>Thanh Toán</h1>

      <div className="checkout-container">
        {/* ── Form ─────────────────────────────────────────────────────────── */}
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
                  onChange={handleInputChange('fullName')}
                  placeholder="Nguyễn Anh Đức"
                  required
                />
                {formErrors.fullName && (
                  <span className="field-error">{formErrors.fullName}</span>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Email *</label>
                  <input
                    type="email"
                    inputMode="email"
                    value={formData.email}
                    onChange={handleInputChange('email')}
                    placeholder="email@example.com"
                    required
                  />
                  {formErrors.email && (
                    <span className="field-error">{formErrors.email}</span>
                  )}
                </div>
                <div className="form-group">
                  <label>Số Điện Thoại *</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={formData.phone}
                    onChange={handleInputChange('phone')}
                    placeholder="0908474355"
                    required
                  />
                  {formErrors.phone && (
                    <span className="field-error">{formErrors.phone}</span>
                  )}
                </div>
              </div>

              {/* Tỉnh / Thành phố */}
              <div className="form-group">
                <label>Tỉnh / Thành phố *</label>
                <select
                  value={selectedProvinceId}
                  onChange={handleProvinceChange}
                  required
                  disabled={isLoadingAddress}
                >
                  <option value="">
                    {isLoadingAddress ? 'Đang tải...' : 'Chọn tỉnh/thành'}
                  </option>
                  {provinces.map((p) => (
                    <option key={p.Id} value={p.Id}>
                      {p.Name}
                    </option>
                  ))}
                </select>
                {formErrors.provinceCity && (
                  <span className="field-error">{formErrors.provinceCity}</span>
                )}
              </div>

              <div className="form-row">
                {/* Quận / Huyện */}
                <div className="form-group">
                  <label>Quận / Huyện *</label>
                  <select
                    value={selectedDistrictId}
                    onChange={handleDistrictChange}
                    required
                    disabled={!districts.length}
                  >
                    <option value="">Chọn quận/huyện</option>
                    {districts.map((d) => (
                      <option key={d.Id} value={d.Id}>
                        {d.Name}
                      </option>
                    ))}
                  </select>
                  {formErrors.district && (
                    <span className="field-error">{formErrors.district}</span>
                  )}
                </div>

                {/* Phường / Xã */}
                <div className="form-group">
                  <label>Phường / Xã *</label>
                  <select
                    value={wards.find((w) => w.Name === formData.ward)?.Id || ''}
                    onChange={handleWardChange}
                    required
                    disabled={!wards.length}
                  >
                    <option value="">Chọn phường/xã</option>
                    {wards.map((w) => (
                      <option key={w.Id} value={w.Id}>
                        {w.Name}
                      </option>
                    ))}
                  </select>
                  {formErrors.ward && (
                    <span className="field-error">{formErrors.ward}</span>
                  )}
                </div>
              </div>

              {/* Số nhà, tên đường */}
              <div className="form-group">
                <label>Số nhà, tên đường *</label>
                <input
                  type="text"
                  value={formData.specificAddress}
                  onChange={handleInputChange('specificAddress')}
                  placeholder="76 Nguyễn Sơn"
                  required
                />
                {formErrors.specificAddress && (
                  <span className="field-error">{formErrors.specificAddress}</span>
                )}
              </div>

              <div className="address-preview">
                <strong>Địa chỉ đầy đủ:</strong>{' '}
                {fullShippingAddress || 'Chưa hoàn tất địa chỉ'}
              </div>
            </div>

            {/* Phương thức thanh toán */}
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

        {/* ── Order Summary ─────────────────────────────────────────────────── */}
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
              <span>
                {shipping === 0
                  ? 'Miễn Phí'
                  : shipping.toLocaleString('vi-VN') + ' VNĐ'}
              </span>
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