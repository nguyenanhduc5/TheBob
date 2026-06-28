import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { authAPI, cartAPI, ordersAPI } from '../api/app';
import '../styles/Checkout.css';

// ✅ GHN Config - đặt vào .env
const GHN_TOKEN = process.env.REACT_APP_GHN_TOKEN;
const GHN_SHOP_ID = process.env.REACT_APP_GHN_SHOP_ID;
const GHN_BASE_URL = 'https://online-gateway.ghn.vn/shiip/public-api';

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
  } catch (e) {
    return null;
  }
};

// ✅ GHN API helpers
const ghnFetch = async (endpoint, body = null) => {
  const options = {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Token': GHN_TOKEN,
    },
  };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(`${GHN_BASE_URL}${endpoint}`, options);
  const data = await res.json();
  if (data.code !== 200) throw new Error(data.message || 'GHN API error');
  return data.data;
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
    paymentMethod: 'cod',
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // ✅ GHN States
  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [wards, setWards] = useState([]);
  const [selectedProvince, setSelectedProvince] = useState(null); // { ProvinceID, ProvinceName }
  const [selectedDistrict, setSelectedDistrict] = useState(null); // { DistrictID, DistrictName }
  const [selectedWard, setSelectedWard] = useState(null);         // { WardCode, WardName }
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingWards, setLoadingWards] = useState(false);

  // ✅ Shipping fee states
  const [shippingFee, setShippingFee] = useState(null);      // null = chưa tính
  const [loadingShipping, setLoadingShipping] = useState(false);

  // Auto fill profile
  useEffect(() => {
    const autoFillProfile = async () => {
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
      } catch (error) {
        console.error('Failed to fetch profile:', error);
      }
    };
    autoFillProfile();
  }, [token]);

  // ✅ Load tất cả tỉnh/thành từ GHN
  useEffect(() => {
    const loadProvinces = async () => {
      try {
        const data = await ghnFetch('/master-data/province');
        // Sắp xếp theo tên
        const sorted = (Array.isArray(data) ? data : []).sort((a, b) =>
          a.ProvinceName.localeCompare(b.ProvinceName, 'vi')
        );
        setProvinces(sorted);
      } catch (error) {
        console.error('Failed to load provinces:', error);
        addNotification('Không tải được danh sách tỉnh/thành', 'error');
      }
    };
    loadProvinces();
  }, [addNotification]);

  // ✅ Tính phí ship khi đã có đủ địa chỉ
  const calculateShipping = useCallback(async (districtId, wardCode) => {
    if (!districtId || !wardCode || !GHN_SHOP_ID) return;

    setLoadingShipping(true);
    try {
      // Tính tổng khối lượng (giả định 500g/sản phẩm nếu không có data)
      const totalWeight = cartItems.reduce((sum, item) => {
        return sum + ((item.weight || 500) * item.quantity);
      }, 0);

      const data = await ghnFetch('/v2/shipping-order/fee', {
        shop_id: parseInt(GHN_SHOP_ID),
        service_type_id: 2, // 2 = Hàng nhẹ (E-Commerce)
        to_district_id: districtId,
        to_ward_code: String(wardCode),
        weight: totalWeight,
        insurance_value: cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
      });

      setShippingFee(data.total || 0);
    } catch (error) {
      console.error('Failed to calculate shipping:', error);
      // Fallback về 30k nếu GHN lỗi
      setShippingFee(30000);
      addNotification('Không tính được phí ship, áp dụng mặc định 30.000đ', 'warning');
    } finally {
      setLoadingShipping(false);
    }
  }, [cartItems, addNotification]);

  // ✅ Địa chỉ đầy đủ
  const fullShippingAddress = useMemo(() => {
    return [
      formData.specificAddress,
      selectedWard?.WardName,
      selectedDistrict?.DistrictName,
      selectedProvince?.ProvinceName,
    ].filter(Boolean).join(', ');
  }, [formData.specificAddress, selectedWard, selectedDistrict, selectedProvince]);

  // ✅ Tính toán tiền
  const subtotal = useMemo(() =>
    cartItems.reduce((total, item) => total + (item.price * item.quantity), 0),
    [cartItems]
  );

  // Chỉ tính tổng khi đã có phí ship
  const total = useMemo(() => {
    if (shippingFee === null) return subtotal;
    return subtotal + shippingFee;
  }, [subtotal, shippingFee]);

  const handleInputChange = (field) => (e) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
    if (formErrors[field]) setFormErrors(prev => ({ ...prev, [field]: '' }));
  };

  // ✅ Chọn tỉnh/thành → load quận/huyện từ GHN
  const handleProvinceChange = async (e) => {
    const provinceId = parseInt(e.target.value);
    const province = provinces.find(p => p.ProvinceID === provinceId);

    setSelectedProvince(province || null);
    setSelectedDistrict(null);
    setSelectedWard(null);
    setDistricts([]);
    setWards([]);
    setShippingFee(null); // Reset phí ship

    if (!provinceId) return;

    setLoadingDistricts(true);
    try {
      const data = await ghnFetch('/master-data/district', { province_id: provinceId });
      const sorted = (Array.isArray(data) ? data : []).sort((a, b) =>
        a.DistrictName.localeCompare(b.DistrictName, 'vi')
      );
      setDistricts(sorted);
    } catch (error) {
      console.error('Failed to load districts:', error);
      addNotification('Không tải được danh sách quận/huyện', 'error');
    } finally {
      setLoadingDistricts(false);
    }
  };

  // ✅ Chọn quận/huyện → load phường/xã từ GHN
  const handleDistrictChange = async (e) => {
    const districtId = parseInt(e.target.value);
    const district = districts.find(d => d.DistrictID === districtId);

    setSelectedDistrict(district || null);
    setSelectedWard(null);
    setWards([]);
    setShippingFee(null); // Reset phí ship

    if (!districtId) return;

    setLoadingWards(true);
    try {
      const data = await ghnFetch('/master-data/ward', { district_id: districtId });
      const sorted = (Array.isArray(data) ? data : []).sort((a, b) =>
        a.WardName.localeCompare(b.WardName, 'vi')
      );
      setWards(sorted);
    } catch (error) {
      console.error('Failed to load wards:', error);
      addNotification('Không tải được danh sách phường/xã', 'error');
    } finally {
      setLoadingWards(false);
    }
  };

  // ✅ Chọn phường/xã → tính phí ship ngay
  const handleWardChange = (e) => {
    const wardCode = e.target.value;
    const ward = wards.find(w => String(w.WardCode) === String(wardCode));

    setSelectedWard(ward || null);
    setShippingFee(null);

    if (ward && selectedDistrict) {
      // Tính phí ship ngay khi chọn xong phường/xã
      calculateShipping(selectedDistrict.DistrictID, ward.WardCode);
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.fullName.trim()) errors.fullName = 'Họ tên là bắt buộc';
    if (!emailRegex.test(formData.email.trim())) errors.email = 'Email không hợp lệ';
    if (!phoneRegex.test(formData.phone.trim())) errors.phone = 'SĐT phải là số Việt Nam hợp lệ';
    if (!selectedProvince) errors.provinceCity = 'Vui lòng chọn tỉnh/thành';
    if (!selectedDistrict) errors.district = 'Vui lòng chọn quận/huyện';
    if (!selectedWard) errors.ward = 'Vui lòng chọn phường/xã';
    if (!formData.specificAddress.trim()) errors.specificAddress = 'Vui lòng nhập số nhà, tên đường';
    if (shippingFee === null) errors.shipping = 'Đang tính phí vận chuyển...';
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
        setIsProcessing(false);
        return;
      }

      await cartAPI.syncCart(
        cartItems.map(item => ({ variantId: item.variantId, quantity: item.quantity }))
      );

      const orderData = {
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
        provinceCity: selectedProvince?.ProvinceName || '',
        district: selectedDistrict?.DistrictName || '',
        ward: selectedWard?.WardName || '',
        specificAddress: formData.specificAddress.trim(),
        shippingFee: shippingFee || 0,
        paymentMethod: formData.paymentMethod,
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
                {formErrors.fullName && <span className="field-error">{formErrors.fullName}</span>}
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
                  {formErrors.email && <span className="field-error">{formErrors.email}</span>}
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
                  {formErrors.phone && <span className="field-error">{formErrors.phone}</span>}
                </div>
              </div>

              {/* ✅ Tỉnh/Thành - GHN API */}
              <div className="form-group">
                <label>Tỉnh / Thành phố *</label>
                <select
                  value={selectedProvince?.ProvinceID || ''}
                  onChange={handleProvinceChange}
                  required
                >
                  <option value="">-- Chọn tỉnh/thành phố --</option>
                  {provinces.map(province => (
                    <option key={province.ProvinceID} value={province.ProvinceID}>
                      {province.ProvinceName}
                    </option>
                  ))}
                </select>
                {formErrors.provinceCity && <span className="field-error">{formErrors.provinceCity}</span>}
              </div>

              <div className="form-row">
                {/* ✅ Quận/Huyện - GHN API */}
                <div className="form-group">
                  <label>Quận / Huyện *</label>
                  <select
                    value={selectedDistrict?.DistrictID || ''}
                    onChange={handleDistrictChange}
                    required
                    disabled={!selectedProvince || loadingDistricts}
                  >
                    <option value="">
                      {loadingDistricts ? 'Đang tải...' : '-- Chọn quận/huyện --'}
                    </option>
                    {districts.map(district => (
                      <option key={district.DistrictID} value={district.DistrictID}>
                        {district.DistrictName}
                      </option>
                    ))}
                  </select>
                  {formErrors.district && <span className="field-error">{formErrors.district}</span>}
                </div>

                {/* ✅ Phường/Xã - GHN API */}
                <div className="form-group">
                  <label>Phường / Xã *</label>
                  <select
                    value={selectedWard?.WardCode || ''}
                    onChange={handleWardChange}
                    required
                    disabled={!selectedDistrict || loadingWards}
                  >
                    <option value="">
                      {loadingWards ? 'Đang tải...' : '-- Chọn phường/xã --'}
                    </option>
                    {wards.map(ward => (
                      <option key={ward.WardCode} value={ward.WardCode}>
                        {ward.WardName}
                      </option>
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

              {fullShippingAddress && (
                <div className="address-preview">
                  <strong>Địa chỉ đầy đủ:</strong> {fullShippingAddress}
                </div>
              )}
            </div>

            <div className="form-section">
              <h2>Phương Thức Thanh Toán</h2>
              <div className="payment-options">
                <div className="payment-option">
                  <input type="radio" id="payment-cod" name="paymentMethod" value="cod"
                    checked={formData.paymentMethod === 'cod'} onChange={handleInputChange('paymentMethod')} />
                  <label htmlFor="payment-cod">
                    <span className="payment-title">Thanh Toán Khi Nhận Hàng (COD)</span>
                    <span className="payment-description">Trả tiền khi nhận hàng</span>
                  </label>
                </div>
                <div className="payment-option">
                  <input type="radio" id="payment-bank" name="paymentMethod" value="bank_transfer"
                    checked={formData.paymentMethod === 'bank_transfer'} onChange={handleInputChange('paymentMethod')} />
                  <label htmlFor="payment-bank">
                    <span className="payment-title">Chuyển Khoản QR Banking</span>
                    <span className="payment-description">Chuyển tiền vào tài khoản</span>
                  </label>
                </div>
                <div className="payment-option">
                  <input type="radio" id="payment-qr" name="paymentMethod" value="qr"
                    checked={formData.paymentMethod === 'qr'} onChange={handleInputChange('paymentMethod')} />
                  <label htmlFor="payment-qr">
                    <span className="payment-title">Thanh Toán Bằng QR Code</span>
                    <span className="payment-description">Quét mã QR Code chuyển khoản</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button type="button" onClick={() => navigate('/cart')} className="btn-back">
                Quay Lại Giỏ Hàng
              </button>
              <button
                type="submit"
                disabled={isProcessing || loadingShipping || shippingFee === null}
                className="btn-place-order"
              >
                {isProcessing ? 'Đang xử lý...' : loadingShipping ? 'Đang tính phí ship...' : 'Đặt Hàng'}
              </button>
            </div>
          </form>
        </div>

        {/* ✅ Order Summary với phí ship động */}
        <div className="order-summary-section">
          <div className="order-summary">
            <h2>Tóm Tắt Đơn Hàng</h2>

            <div className="summary-items">
              {cartItems.map(item => (
                <div key={`${item.id}-${item.selectedSize}-${item.selectedColor}`} className="summary-item">
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

            {/* ✅ Phí ship chỉ hiện khi đã chọn đủ địa chỉ */}
            <div className="summary-row">
              <span>Phí vận chuyển:</span>
              <span>
                {loadingShipping
                  ? '⏳ Đang tính...'
                  : shippingFee === null
                    ? <span style={{ color: '#888', fontStyle: 'italic', fontSize: 13 }}>
                        Chọn địa chỉ để tính phí
                      </span>
                    : shippingFee === 0
                      ? 'Miễn phí'
                      : `${shippingFee.toLocaleString('vi-VN')} VNĐ`
                }
              </span>
            </div>

            <div className="summary-row total">
              <span>Tổng Cộng:</span>
              <span>
                {shippingFee === null
                  ? <span style={{ color: '#888' }}>Chưa tính phí ship</span>
                  : `${total.toLocaleString('vi-VN')} VNĐ`
                }
              </span>
            </div>

            {/* Thông báo nhập địa chỉ */}
            {!selectedWard && (
              <div style={{
                marginTop: 12,
                padding: '8px 12px',
                background: '#fff8e1',
                border: '1px solid #ffc107',
                borderRadius: 6,
                fontSize: 13,
                color: '#856404'
              }}>
                📍 Vui lòng chọn đầy đủ địa chỉ để xem phí vận chuyển
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}