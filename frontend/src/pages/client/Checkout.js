import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { usePreferences } from '../../context/PreferencesContext';
import { authAPI, cartAPI, ordersAPI, shippingAPI, promotionsAPI } from '../../api/app';
import '../../styles/Checkout.css';

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
  const { t } = usePreferences();

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
  const submittingRef = useRef(false);
  const idempotencyKeyRef = useRef(null);
  const [formErrors, setFormErrors] = useState({});

  const [couponCode, setCouponCode] = useState('');
  const [couponInput, setCouponInput] = useState('');
  const [promoPreview, setPromoPreview] = useState(null);  // { totalDiscount, couponDiscount, appliedCouponCode, ... }
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError]   = useState('');
  const [myVouchers, setMyVouchers] = useState([]);
  // Voucher cá nhân (UserCoupon) — tách riêng khỏi couponCode thông thường
  const [selectedVoucherId, setSelectedVoucherId] = useState(null);
  const [selectedVoucherLabel, setSelectedVoucherLabel] = useState('');

  useEffect(() => {
    promotionsAPI.getMyVouchers()
      .then(res => {
        const raw = res?.data ?? res;
        const list = Array.isArray(raw) ? raw : (raw?.items || []);
        setMyVouchers(list.filter(v => !v.isUsed && !v.isExpired));
      })
      .catch(() => setMyVouchers([]));
  }, []);

  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [wards, setWards] = useState([]);

  const [selectedProvince, setSelectedProvince] = useState({ id: null, name: '' });
  const [selectedDistrict, setSelectedDistrict] = useState({ id: null, name: '' });
  const [selectedWard, setSelectedWard] = useState({ code: '', name: '' });

  const [shippingFee, setShippingFee] = useState(null);
  const [isCalcFee, setIsCalcFee] = useState(false);

  // Địa chỉ đã lưu sẵn trong Profile, chờ danh sách tỉnh/thành tải xong để tự động chọn
  const [pendingProfileAddress, setPendingProfileAddress] = useState(null);
  const addressAutoFillRef = useRef(false);

  // Tạm tính (subtotal) - tính trước, dùng lại ở nhiều nơi (kể cả trong effect khuyến mãi)
  const subtotal = useMemo(
    () => cartItems.reduce((total, item) => total + item.price * item.quantity, 0),
    [cartItems]
  );

  // Phí vận chuyển hiển thị: miễn phí nếu subtotal > 500k, ngược lại lấy phí GHN đã tính (fallback 30.000đ)
  const shipping = subtotal > 500000 ? 0 : (shippingFee ?? 30000);

  // Tính phí vận chuyển GHN cho một quận/phường cụ thể — dùng chung cho cả
  // lựa chọn thủ công (handleWardChange) và tự động điền từ địa chỉ đã lưu.
  const calculateShippingFee = useCallback(async (districtId, wardCode) => {
    setIsCalcFee(true);
    try {
      const totalWeight = cartItems.reduce((sum, item) => sum + item.quantity * 500, 0);
      const insuranceValue = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

      const result = await shippingAPI.calculateFee({
        toDistrictId: districtId,
        toWardCode: wardCode,
        weight: Math.max(totalWeight, 200),
        length: 20,
        width: 15,
        height: 10,
        insuranceValue,
      });
      const feeValue = result?.total ?? result?.Total ?? result?.data?.total ?? result?.data?.Total ?? 30000;
      setShippingFee(Number(feeValue));
    } catch (error) {
      console.error('Fee calculation failed:', error);
      // ✅ FIX: Hiện lỗi thật cho người dùng/dev thấy thay vì âm thầm dùng phí mặc định 30k.
      // Trước đây lỗi chỉ log console nên không ai biết vì sao phí luôn là 30.000đ.
      addNotification(
        t('checkout.shipping.error', { error: error?.message || t('checkout.unknownError') }),
        'warning'
      );
      setShippingFee(30000);
    } finally {
      setIsCalcFee(false);
    }
  }, [cartItems, addNotification, t]);

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
            // Địa chỉ đã lưu trong Profile → điền sẵn số nhà/tên đường
            specificAddress: prev.specificAddress || profile.specificAddress || '',
          }));

          // Nếu Profile đã có địa chỉ tỉnh/quận/phường đã lưu, ghi nhận lại để
          // effect dưới tự động chọn khi danh sách tỉnh/thành tải xong.
          if (profile.ghnProvinceId) {
            setPendingProfileAddress({
              provinceId: profile.ghnProvinceId,
              districtId: profile.ghnDistrictId ?? null,
              wardCode: profile.ghnWardCode ?? '',
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch profile in Checkout:', error);
      }
    };

    autoFillProfile();
  }, [token]);

  useEffect(() => {
    shippingAPI.getProvinces()
      .then(setProvinces)
      .catch(() => addNotification(t('checkout.error.provinces'), 'error'));
  }, [addNotification, t]);

  // Tự động chọn Tỉnh/Thành → Quận/Huyện → Phường/Xã từ địa chỉ đã lưu trong
  // Profile (một lần duy nhất, chỉ khi user chưa tự chọn địa chỉ nào trong form).
  useEffect(() => {
    if (addressAutoFillRef.current) return;
    if (!pendingProfileAddress || provinces.length === 0) return;
    if (selectedProvince.id) { addressAutoFillRef.current = true; return; }

    addressAutoFillRef.current = true;

    (async () => {
      const province = provinces.find((p) => p.provinceId === pendingProfileAddress.provinceId);
      if (!province) return;
      setSelectedProvince({ id: province.provinceId, name: province.provinceName });

      let districtList = [];
      try {
        districtList = await shippingAPI.getDistricts(province.provinceId);
        setDistricts(districtList);
      } catch (error) {
        console.error('Failed to load districts:', error);
        return;
      }
      if (!pendingProfileAddress.districtId) return;

      const district = districtList.find((d) => d.districtId === pendingProfileAddress.districtId);
      if (!district) return;
      setSelectedDistrict({ id: district.districtId, name: district.districtName });

      let wardList = [];
      try {
        wardList = await shippingAPI.getWards(district.districtId);
        setWards(wardList);
      } catch (error) {
        console.error('Failed to load wards:', error);
        return;
      }
      if (!pendingProfileAddress.wardCode) return;

      const ward = wardList.find((w) => w.wardCode === pendingProfileAddress.wardCode);
      if (!ward) return;
      setSelectedWard({ code: ward.wardCode, name: ward.wardName });

      calculateShippingFee(district.districtId, ward.wardCode);
    })();
  }, [pendingProfileAddress, provinces, selectedProvince.id, calculateShippingFee]);

  // Tính khuyến mãi: couponCode (mã nhập tay) HOẶC selectedVoucherId (voucher cá nhân)
  useEffect(() => {
    async function fetchAndCalculatePromotions() {
      if (cartItems.length === 0) {
        setPromoPreview(null);
        return;
      }

      try {
        // Đồng bộ giỏ hàng lên backend DB trước để backend có CartItems thực tế nhằm kiểm tra Scope/Điều kiện
        try {
          const syncItems = cartItems
            .filter((item) => item.variantId)
            .map((item) => ({
              variantId: item.variantId,
              quantity: item.quantity,
            }));
          if (syncItems.length > 0) {
            await cartAPI.syncCart(syncItems);
          }
        } catch (syncErr) {
          console.warn('Sync cart before promo calc warning:', syncErr);
        }

        // Gửi kèm phí ship và userCouponId (nếu có) để backend tính đúng
        const result = await promotionsAPI.calculatePromotions(couponCode, shipping, selectedVoucherId);

        setPromoPreview({
          automaticDiscount: result.automaticDiscount || 0,
          couponDiscount: result.couponDiscount || 0,
          shippingDiscount: result.shippingDiscount || 0,
          totalDiscount: result.totalDiscount || 0,
          subtotal: result.subtotal || subtotal,
          shipping: result.shipping ?? shipping,
          finalAmount: result.finalAmount || 0,
          appliedCouponCode: result.appliedCouponCode || '',
          appliedPromotions: result.appliedPromotions || []
        });
      } catch (error) {
        console.error('Failed to calculate promotions in Checkout:', error);
        if (couponCode) {
          setCouponCode('');
          setCouponInput('');
          setCouponError(t('checkout.coupon.invalid'));
        }
        if (selectedVoucherId) {
          setSelectedVoucherId(null);
          setSelectedVoucherLabel('');
          setCouponError(t('checkout.voucher.invalid'));
        }
      }
    }

    fetchAndCalculatePromotions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartItems, couponCode, shipping, selectedVoucherId]);

  const fullShippingAddress = useMemo(() => {
    return [
      formData.specificAddress,
      selectedWard.name,
      selectedDistrict.name,
      selectedProvince.name,
    ].filter(Boolean).join(', ');
  }, [formData.specificAddress, selectedDistrict.name, selectedProvince.name, selectedWard.name]);

  const handleInputChange = (field) => (e) => {
    setFormData({
      ...formData,
      [field]: e.target.value,
    });
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.fullName.trim()) errors.fullName = t('checkout.error.requiredName');
    if (!emailRegex.test(formData.email.trim())) errors.email = t('checkout.error.invalidEmail');
    if (!phoneRegex.test(formData.phone.trim())) errors.phone = t('checkout.error.invalidPhone');
    if (!selectedProvince.id) errors.provinceCity = t('checkout.error.requiredProvince');
    if (!selectedDistrict.id) errors.district = t('checkout.error.requiredDistrict');
    if (!selectedWard.code) errors.ward = t('checkout.error.requiredWard');
    if (!formData.specificAddress.trim()) errors.specificAddress = t('checkout.error.requiredStreet');

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleProvinceChange = async (e) => {
    const id = parseInt(e.target.value, 10);
    const province = provinces.find((p) => p.provinceId === id);

    setSelectedProvince({ id: province?.provinceId ?? null, name: province?.provinceName ?? '' });
    setSelectedDistrict({ id: null, name: '' });
    setSelectedWard({ code: '', name: '' });
    setDistricts([]);
    setWards([]);
    setShippingFee(null);

    if (!province) return;

    try {
      const data = await shippingAPI.getDistricts(province.provinceId);
      setDistricts(data);
    } catch (error) {
      console.error('Failed to load districts:', error);
      addNotification(t('checkout.error.districts'), 'error');
    }
  };

  const handleDistrictChange = async (e) => {
    const id = parseInt(e.target.value, 10);
    const district = districts.find((d) => d.districtId === id);

    setSelectedDistrict({ id: district?.districtId ?? null, name: district?.districtName ?? '' });
    setSelectedWard({ code: '', name: '' });
    setWards([]);
    setShippingFee(null);

    if (!district) return;

    try {
      const data = await shippingAPI.getWards(district.districtId);
      setWards(data);
    } catch (error) {
      console.error('Failed to load wards:', error);
      addNotification(t('checkout.error.wards'), 'error');
    }
  };

  const handleWardChange = (e) => {
    const code = e.target.value;
    const ward = wards.find((w) => w.wardCode === code);

    setSelectedWard({ code: ward?.wardCode ?? '', name: ward?.wardName ?? '' });

    if (!ward || !selectedDistrict.id) return;
    calculateShippingFee(selectedDistrict.id, ward.wardCode);
  };

  // ── Validate coupon via backend ────────────────────────────────
  const handleApplyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setCouponLoading(true);
    setCouponError('');
    try {
      // Validate coupon first
      const validResult = await promotionsAPI.validateCoupon(code);
      if (validResult?.isValid) {
        setSelectedVoucherId(null);
        setSelectedVoucherLabel('');
        setCouponCode(code);
        // After coupon code is set, the useEffect will call calculatePromotions
        // and update promoPreview with the full calculation
        addNotification(t('checkout.coupon.applied', { code }), 'success');
      } else {
        setCouponError(validResult?.errorMessage || t('checkout.coupon.invalid'));
      }
    } catch (err) {
      setCouponError(err?.message || t('checkout.coupon.invalid'));
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setCouponCode('');
    setCouponInput('');
    setSelectedVoucherId(null);
    setSelectedVoucherLabel('');
    setPromoPreview(null);
    setCouponError('');
  };
//checkout
  const handleSubmitOrder = async (e) => {
    e.preventDefault();

    if (submittingRef.current) return;
    submittingRef.current = true;

    if (!validateForm()) {
      addNotification(t('checkout.error.checkAddress'), 'warning');
      submittingRef.current = false;
      return; 
    }

    setIsProcessing(true);

    try {
      const invalidItem = cartItems.find((item) => !item.variantId);
      if (invalidItem) {
        addNotification(t('checkout.error.variant'), 'error');
        setIsProcessing(false);
        submittingRef.current = false;
        return;
      }
//api/cart
      await cartAPI.syncCart(
        cartItems.map((item) => ({
          variantId: item.variantId,
          quantity: item.quantity,
        }))
      );
// Tạo dữ liệu đơn hàng
      const orderData = {
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
        fullName: formData.fullName.trim(),
        provinceCity: selectedProvince.name,
        district: selectedDistrict.name,
        ward: selectedWard.name,
        specificAddress: formData.specificAddress.trim(),
        paymentMethod: formData.paymentMethod,
        ghnProvinceId: selectedProvince.id,
        ghnDistrictId: selectedDistrict.id,
        ghnWardCode: selectedWard.code,
        couponCode: couponCode || undefined,
        userCouponId: selectedVoucherId ? Number(selectedVoucherId) : undefined,
      };

      // Đảm bảo Idempotency Key duy nhất cho lần thanh toán này
      if (!idempotencyKeyRef.current) {
        idempotencyKeyRef.current = (typeof crypto !== 'undefined' && crypto.randomUUID)
          ? crypto.randomUUID()
          : 'idemp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
      }

//api/ Tạo order dữ liệu đơn hàng kèm Idempotency-Key
      const order = await ordersAPI.createOrder(orderData, idempotencyKeyRef.current);

      if (order) {
        idempotencyKeyRef.current = null; // Reset key sau khi đã xử lý thành công
        addNotification(t('checkout.success'), 'success');
//cod
        if (formData.paymentMethod === 'cod') {
          clearCart();
        }

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
        idempotencyKeyRef.current = null;
        addNotification(error.payload.message || t('checkout.error.pending'), 'warning');
        navigate(`/payment/${error.payload.orderId}`);
        return;
      }
      addNotification(error?.message || t('checkout.error.order'), 'error');
    } finally {
      setIsProcessing(false);
      submittingRef.current = false;
    }
  };

  if (cartItems.length === 0) {
    return (
      <div className="checkout-page">
        <div className="empty-message">
          <h2>{t('checkout.empty.title')}</h2>
          <p>{t('checkout.empty.description')}</p>
          <button onClick={() => navigate('/products')} className="btn-back-shopping">
            {t('checkout.empty.back')}
          </button>
        </div>
      </div>
    );
  }

  // ✅ FIX: Tổng cộng cuối cùng luôn cộng đủ subtotal + shipping - discount,
  // dù backend (promoPreview) có trả thiếu trường nào cũng không bị mất tiền ship.
  const finalTotal = promoPreview
    ? subtotal + shipping - (promoPreview.totalDiscount || 0)
    : subtotal + shipping;

  return (
    <div className="checkout-page">
      <header className="checkout-heading">
        <p className="checkout-eyebrow">THEBOB / CHECKOUT</p>
        <h1>{t('checkout.title')}</h1>
        <p>{t('checkout.description')}</p>
        <ol className="checkout-steps" aria-label={t('checkout.steps')}>
          <li className="completed"><span>✓</span> {t('checkout.step.cart')}</li>
          <li aria-current="step"><span>02</span> {t('checkout.step.payment')}</li>
          <li><span>03</span> {t('checkout.step.complete')}</li>
        </ol>
      </header>

      <div className="checkout-container">
        <div className="checkout-form-section">
          <form onSubmit={handleSubmitOrder} className="checkout-form">
            <div className="form-section">
              <h2><span className="checkout-section-number">01</span> {t('checkout.shippingInfo')}</h2>

              <div className="form-group">
                <label>{t('checkout.fullName')}</label>
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
                  <label>{t('checkout.email')}</label>
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
                  <label>{t('checkout.phone')}</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    pattern="^(0(3|5|7|8|9)\d{8}|\+84(3|5|7|8|9)\d{8})$"
                    value={formData.phone}
                    onChange={handleInputChange('phone')}
                    placeholder="0908474355"
                    required
                  />
                  {formErrors.phone && <span className="field-error">{formErrors.phone}</span>}
                </div>
              </div>

              <div className="form-group">
                <label>{t('checkout.province')}</label>
                <select value={selectedProvince.id || ''} onChange={handleProvinceChange} required>
                  <option value="">{t('checkout.selectProvince')}</option>
                  {provinces.map((p, index) => (
                    <option key={`province-${p.provinceId}-${index}`} value={p.provinceId}>{p.provinceName}</option>
                  ))}
                </select>
                {formErrors.provinceCity && <span className="field-error">{formErrors.provinceCity}</span>}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>{t('checkout.district')}</label>
                  <select
                    value={selectedDistrict.id || ''}
                    onChange={handleDistrictChange}
                    required
                    disabled={!districts.length}
                  >
                    <option value="">{t('checkout.selectDistrict')}</option>
                    {districts.map((d, index) => (
                      <option key={`district-${d.districtId}-${index}`} value={d.districtId}>{d.districtName}</option>
                    ))}
                  </select>
                  {formErrors.district && <span className="field-error">{formErrors.district}</span>}
                </div>

                <div className="form-group">
                  <label>{t('checkout.ward')}</label>
                  <select
                    value={selectedWard.code || ''}
                    onChange={handleWardChange}
                    required
                    disabled={!wards.length}
                  >
                    <option value="">{t('checkout.selectWard')}</option>
                    {wards.map((w, index) => (
                      <option key={`ward-${w.wardCode}-${index}`} value={w.wardCode}>{w.wardName}</option>
                    ))}
                  </select>
                  {formErrors.ward && <span className="field-error">{formErrors.ward}</span>}
                </div>
              </div>

              <div className="form-group">
                <label>{t('checkout.street')}</label>
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
                <strong>{t('checkout.fullAddress')}</strong> {fullShippingAddress || t('checkout.addressIncomplete')}
              </div>
            </div>

            <div className="form-section">
              <h2><span className="checkout-section-number">02</span> {t('checkout.paymentMethod')}</h2>

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
                    <span className="payment-title">{t('checkout.payment.cod')}</span>
                    <span className="payment-description">{t('checkout.payment.cod.description')}</span>
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
                    <span className="payment-title">{t('checkout.payment.bank')}</span>
                    <span className="payment-description">{t('checkout.payment.bank.description')}</span>
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
                    <span className="payment-title">{t('checkout.payment.qr')}</span>
                    <span className="payment-description">{t('checkout.payment.qr.description')}</span>
                  </label>
                </div>
              </div>
            </div>

            {/* ── Coupon Input ──────────────────────────────────── */}
            <div className="form-section coupon-section">
              <h2><span className="checkout-section-number">03</span> {t('checkout.coupon')}</h2>

              {/* Hiển thị trạng thái đã áp dụng */}
              {(couponCode || selectedVoucherId) ? (
                <div className="coupon-applied">
                  <span className="coupon-tag">
                    ✅ {selectedVoucherId ? selectedVoucherLabel : couponCode}
                  </span>
                  {promoPreview?.couponDiscount > 0 && (
                    <span className="coupon-saving">{t('checkout.coupon.saving', { amount: promoPreview.couponDiscount.toLocaleString('vi-VN') })}</span>
                  )}
                  <button type="button" className="coupon-remove" onClick={handleRemoveCoupon}>{t('checkout.coupon.remove')}</button>
                </div>
              ) : (
                <>
                  {/* Dropdown chọn Voucher cá nhân (UserCoupon) */}
                  {myVouchers.length > 0 && (
                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                        {t('checkout.voucher.choose')}
                      </label>
                      <select
                        className="coupon-input"
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                        value={selectedVoucherId || ''}
                        onChange={(e) => {
                          const selectedId = e.target.value;
                          if (!selectedId) {
                            handleRemoveCoupon();
                            return;
                          }
                          const v = myVouchers.find(x => String(x.id) === String(selectedId));
                          if (!v) return;
                          setCouponError('');
                          setCouponCode(''); // Xóa mã nhập tay nếu có
                          setCouponInput('');
                          setSelectedVoucherId(v.id);
                          setSelectedVoucherLabel(v.promotionName + (v.note ? ` (${v.note})` : ''));
                          addNotification(t('checkout.voucher.selected', { name: v.promotionName }), 'info');
                        }}
                      >
                        <option value="">{t('checkout.voucher.placeholder')}</option>
                        {myVouchers.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.promotionName}{v.note ? ` (${v.note})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Ô nhập mã thủ công */}
                  <div className="coupon-input-row">
                    <input
                      type="text"
                      value={couponInput}
                      onChange={e => { setCouponInput(e.target.value.toUpperCase()); setCouponError(''); }}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleApplyCoupon())}
                      placeholder={t('checkout.coupon.placeholder')}
                      className="coupon-input"
                      disabled={couponLoading}
                    />
                    <button
                      type="button"
                      className="coupon-apply-btn"
                      onClick={handleApplyCoupon}
                      disabled={couponLoading || !couponInput.trim()}
                    >
                      {couponLoading ? '...' : t('checkout.coupon.apply')}
                    </button>
                  </div>
                </>
              )}
              {couponError && <p className="coupon-error">{couponError}</p>}
            </div>

            <div className="form-actions">
              <button
                type="button"
                onClick={() => navigate('/cart')}
                className="btn-back"
              >
                {t('checkout.backToCart')}
              </button>
              <button
                type="submit"
                disabled={isProcessing}
                className="btn-place-order"
              >
                {isProcessing ? t('checkout.submit.loading') : t('checkout.submit')}
              </button>
            </div>
          </form>
        </div>

        <div className="order-summary-section">
          <div className="order-summary">
            <p className="checkout-eyebrow">{t('checkout.summary.eyebrow')}</p>
            <h2>{t('checkout.summary')}</h2>

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
              <span>{t('checkout.subtotal')}</span>
              <span>{subtotal.toLocaleString('vi-VN')} VNĐ</span>
            </div>

            <div className="summary-row">
              <span>{t('checkout.shipping')}</span>
              <span>
                {isCalcFee
                  ? t('checkout.calculating')
                  : shipping.toLocaleString('vi-VN') + ' VNĐ'}
              </span>
            </div>

            {/* Promotion discount breakdown */}
            {promoPreview && promoPreview.totalDiscount > 0 && (
              <>
                {promoPreview.automaticDiscount > 0 && (
                  <div className="summary-row discount-row">
                    <span>{t('checkout.automaticDiscount')}</span>
                    <span className="discount-amount">-{promoPreview.automaticDiscount.toLocaleString('vi-VN')}₫</span>
                  </div>
                )}
                {promoPreview.couponDiscount > 0 && (
                  <div className="summary-row discount-row">
                    <span>🎟️ Mã {promoPreview.appliedCouponCode}:</span>
                    <span className="discount-amount">-{promoPreview.couponDiscount.toLocaleString('vi-VN')}₫</span>
                  </div>
                )}
                {promoPreview.shippingDiscount > 0 && (
                  <div className="summary-row discount-row">
                    <span>{t('checkout.shippingDiscount')}</span>
                    <span className="discount-amount">-{promoPreview.shippingDiscount.toLocaleString('vi-VN')}₫</span>
                  </div>
                )}
              </>
            )}

            <div className="summary-row total">
              <span>{t('checkout.total')}</span>
              <span>{finalTotal.toLocaleString('vi-VN')} VNĐ</span>
            </div>

            {promoPreview && promoPreview.totalDiscount > 0 && (
              <div className="summary-saving">
                {t('checkout.savings', { amount: promoPreview.totalDiscount.toLocaleString('vi-VN') })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
