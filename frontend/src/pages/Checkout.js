import { useState, useEffect, useMemo } from 'react';
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

  const phoneRegex = /^(0(3|5|7|8|9)\d{8}|\+84(3|5|7|8|9)\d{8})$/;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const [formData, setFormData] = useState({
    fullName: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    specificAddress: '',
    provinceCity: '',
    district: '',
    ward: '',
    paymentMethod: 'cod',
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [wards, setWards] = useState([]);
  const [selectedProvinceName, setSelectedProvinceName] = useState('');
  const [selectedDistrictName, setSelectedDistrictName] = useState('');
  const [selectedWardName, setSelectedWardName] = useState('');

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
          }));
        }
      } catch (error) {
        console.error('Failed to fetch profile in Checkout:', error);
      }
    };

    autoFillProfile();
  }, [token]);

  useEffect(() => {
    const loadProvinces = async () => {
      try {
        const res = await fetch('https://provinces.open-api.vn/api/?depth=1');
        const data = await res.json();
        setProvinces(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to load provinces:', error);
        addNotification('Không tải được danh sách tỉnh/thành', 'error');
      }
    };

    loadProvinces();
  }, [addNotification]);

  const fullShippingAddress = useMemo(() => {
    return [
      formData.specificAddress,
      selectedWardName,
      selectedDistrictName,
      selectedProvinceName,
    ].filter(Boolean).join(', ');
  }, [formData.specificAddress, selectedDistrictName, selectedProvinceName, selectedWardName]);

  const handleInputChange = (field) => (e) => {
    setFormData({
      ...formData,
      [field]: e.target.value,
    });
  };

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

  const handleProvinceChange = async (e) => {
    const provinceCode = e.target.value;
    const province = provinces.find((item) => String(item.code) === String(provinceCode));

    setFormData((prev) => ({
      ...prev,
      provinceCity: province?.name || '',
      district: '',
      ward: '',
    }));
    setSelectedProvinceName(province?.name || '');
    setSelectedDistrictName('');
    setSelectedWardName('');
    setDistricts([]);
    setWards([]);

    if (!provinceCode) return;

    try {
      const res = await fetch(`https://provinces.open-api.vn/api/p/${provinceCode}?depth=2`);
      const data = await res.json();
      setDistricts(Array.isArray(data?.districts) ? data.districts : []);
    } catch (error) {
      console.error('Failed to load districts:', error);
    }
  };

  const handleDistrictChange = async (e) => {
    const districtCode = e.target.value;
    const district = districts.find((item) => String(item.code) === String(districtCode));

    setFormData((prev) => ({
      ...prev,
      district: district?.name || '',
      ward: '',
    }));
    setSelectedDistrictName(district?.name || '');
    setSelectedWardName('');
    setWards([]);

    if (!districtCode) return;

    try {
      const res = await fetch(`https://provinces.open-api.vn/api/d/${districtCode}?depth=2`);
      const data = await res.json();
      setWards(Array.isArray(data?.wards) ? data.wards : []);
    } catch (error) {
      console.error('Failed to load wards:', error);
    }
  };

  const handleWardChange = (e) => {
    const wardCode = e.target.value;
    const ward = wards.find((item) => String(item.code) === String(wardCode));

    setFormData((prev) => ({
      ...prev,
      ward: ward?.name || '',
    }));
    setSelectedWardName(ward?.name || '');
  };

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
        addNotification('Giỏ hàng có sản phẩm chưa chọn biến thể, vui lòng thêm lại sản phẩm.', 'error');
        setIsProcessing(false);
        return;
      }

      // Sync backend cart atomically before checkout.
      await cartAPI.syncCart(
        cartItems.map(item => ({
          variantId: item.variantId,
          quantity: item.quantity
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
                    inputMode="email"
                    value={formData.email}
                    onChange={handleInputChange('email')}
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
                    pattern="^(0(3|5|7|8|9)\d{8}|\\+84(3|5|7|8|9)\\d{8})$"
                    value={formData.phone}
                    onChange={handleInputChange('phone')}
                    placeholder="0908474355"
                    required
                  />
                  {formErrors.phone && <span className="field-error">{formErrors.phone}</span>}
                </div>
              </div>

              <div className="form-group">
                <label>Tỉnh / Thành phố *</label>
                <select value={provinces.find((item) => item.name === formData.provinceCity)?.code || ''} onChange={handleProvinceChange} required>
                  <option value="">Chọn tỉnh/thành</option>
                  {provinces.map((province) => (
                    <option key={province.code} value={province.code}>{province.name}</option>
                  ))}
                </select>
                {formErrors.provinceCity && <span className="field-error">{formErrors.provinceCity}</span>}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Quận / Huyện *</label>
                  <select value={districts.find((item) => item.name === formData.district)?.code || ''} onChange={handleDistrictChange} required disabled={!districts.length}>
                    <option value="">Chọn quận/huyện</option>
                    {districts.map((district) => (
                      <option key={district.code} value={district.code}>{district.name}</option>
                    ))}
                  </select>
                  {formErrors.district && <span className="field-error">{formErrors.district}</span>}
                </div>

                <div className="form-group">
                  <label>Phường / Xã *</label>
                  <select value={wards.find((item) => item.name === formData.ward)?.code || ''} onChange={handleWardChange} required disabled={!wards.length}>
                    <option value="">Chọn phường/xã</option>
                    {wards.map((ward) => (
                      <option key={ward.code} value={ward.code}>{ward.name}</option>
                    ))}
                  </select>
                  {formErrors.ward && <span className="field-error">{formErrors.ward}</span>}
                </div>
              </div>

              <div className="form-group">
                <label>Số nhà, tên đường *</label>
                <input
                  type="text"
                  value={formData.specificAddress}
                  onChange={handleInputChange('specificAddress')}
                  placeholder="76 Nguyễn Sơn"
                  required
                />
                {formErrors.specificAddress && <span className="field-error">{formErrors.specificAddress}</span>}
              </div>
              <div className="address-preview">
                <strong>Địa chỉ đầy đủ:</strong> {fullShippingAddress || 'Chưa hoàn tất địa chỉ'}
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
