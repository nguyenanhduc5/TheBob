import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { usePreferences } from '../../context/PreferencesContext';
import { authAPI, ordersAPI, shippingAPI } from '../../api/app';
import {
  IconLock,
  IconLogout,
  IconPackage,
  IconShoppingBag,
  IconTicket,
  IconUser,
} from '@tabler/icons-react';
import '../../styles/Profile.css';

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_MAP = {
  PendingPayment: { label: 'profile.status.pendingPayment', cls: 'pendingpayment' },
  Pending:        { label: 'profile.status.pending', cls: 'pending' },
  Processing:     { label: 'profile.status.processing', cls: 'processing' },
  Shipped:        { label: 'profile.status.shipped', cls: 'shipped' },
  Delivered:      { label: 'profile.status.delivered', cls: 'delivered' },
  Cancelled:      { label: 'profile.status.cancelled', cls: 'cancelled' },
};

const getInitials = (name = '') =>
  name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';

// ── Component ──────────────────────────────────────────────────────────────────
export default function Profile() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // ✅ FIX: lấy cả loading và isAdminUser (boolean) thay vì gọi isAdmin()
  const { user, token, updateUser, logout, loading: authLoading, isAdminUser } = useAuth();
  const { addNotification } = useNotification();
  const { t, locale } = usePreferences();
  const dateLocale = { vi: 'vi-VN', en: 'en-US', zh: 'zh-CN' }[locale];

  const initialMenu = searchParams.get('menu') || 'account';
  const [activeMenu, setActiveMenu] = useState(initialMenu);
  const [pageLoading, setPageLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const [userOrders, setUserOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const [formData, setFormData] = useState({
    name:            user?.name    || '',
    email:           user?.email   || '',
    phone:           user?.phone   || '',
    specificAddress: '',
  });
  const [successMessage, setSuccessMessage] = useState('');

  // ── Địa chỉ (đồng bộ cấu trúc với Checkout: Tỉnh/Thành → Quận/Huyện → Phường/Xã) ──
  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [wards, setWards] = useState([]);

  const [selectedProvince, setSelectedProvince] = useState({ id: null, name: '' });
  const [selectedDistrict, setSelectedDistrict] = useState({ id: null, name: '' });
  const [selectedWard, setSelectedWard] = useState({ code: '', name: '' });

  // Địa chỉ đã lưu từ server, chờ danh sách tỉnh/thành tải xong để khớp và tự chọn
  const [pendingAddress, setPendingAddress] = useState(null);
  const addressInitRef = useRef(false);

  // Sync URL param → activeMenu
  useEffect(() => {
    const menu = searchParams.get('menu');
    if (menu) setActiveMenu(menu);
  }, [searchParams]);

  // Stable ref cho updateUser
  const updateUserRef = useRef(updateUser);
  useEffect(() => { updateUserRef.current = updateUser; }, [updateUser]);

  // Tải danh sách tỉnh/thành (dùng chung API với Checkout)
  useEffect(() => {
    shippingAPI.getProvinces()
      .then(setProvinces)
      .catch(() => addNotification(t('checkout.error.provinces'), 'error'));
  }, [addNotification, t]);

  // Load profile
  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!token) return;
      setPageLoading(true);
      try {
        const result = await authAPI.getProfile();
        const profile = result?.data;
        if (profile && alive) {
          setFormData({
            name:            profile.name    || '',
            email:           profile.email   || '',
            phone:           profile.phone   || '',
            // hỗ trợ ngược: nếu backend vẫn còn field "address" cũ dạng chuỗi
            specificAddress: profile.specificAddress || profile.address || '',
          });
          setPendingAddress({
            provinceId: profile.ghnProvinceId ?? null,
            districtId: profile.ghnDistrictId ?? null,
            wardCode:   profile.ghnWardCode ?? '',
          });
          updateUserRef.current(profile);
        }
      } catch (err) {
        console.error('Fetch profile error:', err);
      } finally {
        if (alive) setPageLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, [token]);

  const loadDistricts = useCallback(async (provinceId) => {
    try {
      return await shippingAPI.getDistricts(provinceId);
    } catch (err) {
      console.error('Failed to load districts:', err);
      addNotification(t('checkout.error.districts'), 'error');
      return [];
    }
  }, [addNotification, t]);

  const loadWards = useCallback(async (districtId) => {
    try {
      return await shippingAPI.getWards(districtId);
    } catch (err) {
      console.error('Failed to load wards:', err);
      addNotification(t('checkout.error.wards'), 'error');
      return [];
    }
  }, [addNotification, t]);

  // Khi đã có danh sách tỉnh/thành + địa chỉ đã lưu → tự động chọn sẵn tỉnh/quận/phường
  useEffect(() => {
    if (addressInitRef.current) return;
    if (!pendingAddress || provinces.length === 0) return;
    if (!pendingAddress.provinceId) { addressInitRef.current = true; return; }

    addressInitRef.current = true;

    (async () => {
      const province = provinces.find((p) => p.provinceId === pendingAddress.provinceId);
      if (!province) return;
      setSelectedProvince({ id: province.provinceId, name: province.provinceName });

      const districtList = await loadDistricts(province.provinceId);
      setDistricts(districtList);
      if (!pendingAddress.districtId) return;

      const district = districtList.find((d) => d.districtId === pendingAddress.districtId);
      if (!district) return;
      setSelectedDistrict({ id: district.districtId, name: district.districtName });

      const wardList = await loadWards(district.districtId);
      setWards(wardList);
      if (!pendingAddress.wardCode) return;

      const ward = wardList.find((w) => w.wardCode === pendingAddress.wardCode);
      if (ward) setSelectedWard({ code: ward.wardCode, name: ward.wardName });
    })();
  }, [pendingAddress, provinces, loadDistricts, loadWards]);

  // Load orders
  const fetchUserOrders = useCallback(async () => {
    if (!token) return;
    setOrdersLoading(true);
    try {
      const data = await ordersAPI.getUserOrders();
      setUserOrders(data || []);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setOrdersLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (activeMenu === 'orders') fetchUserOrders();
  }, [activeMenu, fetchUserOrders]);

  // SignalR real-time update
  useEffect(() => {
    const handler = () => fetchUserOrders();
    window.addEventListener('order-status-updated', handler);
    return () => window.removeEventListener('order-status-updated', handler);
  }, [fetchUserOrders]);

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const handleInputChange = (field) => (e) =>
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));

  const handleProvinceChange = async (e) => {
    const id = parseInt(e.target.value, 10);
    const province = provinces.find((p) => p.provinceId === id);

    setSelectedProvince({ id: province?.provinceId ?? null, name: province?.provinceName ?? '' });
    setSelectedDistrict({ id: null, name: '' });
    setSelectedWard({ code: '', name: '' });
    setDistricts([]);
    setWards([]);

    if (!province) return;
    const data = await loadDistricts(province.provinceId);
    setDistricts(data);
  };

  const handleDistrictChange = async (e) => {
    const id = parseInt(e.target.value, 10);
    const district = districts.find((d) => d.districtId === id);

    setSelectedDistrict({ id: district?.districtId ?? null, name: district?.districtName ?? '' });
    setSelectedWard({ code: '', name: '' });
    setWards([]);

    if (!district) return;
    const data = await loadWards(district.districtId);
    setWards(data);
  };

  const handleWardChange = (e) => {
    const code = e.target.value;
    const ward = wards.find((w) => w.wardCode === code);
    setSelectedWard({ code: ward?.wardCode ?? '', name: ward?.wardName ?? '' });
  };

  const fullAddressPreview = useMemo(() => [
    formData.specificAddress,
    selectedWard.name,
    selectedDistrict.name,
    selectedProvince.name,
  ].filter(Boolean).join(', '), [formData.specificAddress, selectedWard.name, selectedDistrict.name, selectedProvince.name]);

  const handleUpdateInfo = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) {
      addNotification(t('profile.required'), 'warning');
      return;
    }
    setIsUpdating(true);
    setSuccessMessage('');
    try {
      const result = await authAPI.updateProfile({
        email:           formData.email,
        name:            formData.name,
        phone:           formData.phone,
        specificAddress: formData.specificAddress,
        provinceCity:    selectedProvince.name,
        district:        selectedDistrict.name,
        ward:            selectedWard.name,
        ghnProvinceId:   selectedProvince.id,
        ghnDistrictId:   selectedDistrict.id,
        ghnWardCode:     selectedWard.code,
      });
      const updated = result?.data;
      if (updated) {
        updateUser(updated);
        setSuccessMessage(t('profile.saved'));
        addNotification(t('profile.updated'), 'success');
      } else {
        throw new Error(t('profile.invalidResponse'));
      }
    } catch (err) {
      console.error('Update error:', err);
      addNotification(err.response?.data?.message || err.message || t('profile.connectionError'), 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleChangePassword = (e) => {
    e.preventDefault();
    setSuccessMessage(t('profile.password.comingSoon'));
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const handleLogout = () => {
    logout();
    addNotification(t('profile.logout'), 'info');
    navigate('/');
  };

  // ── Guard: chờ auth load xong trước khi render ────────────────────────────────
  if (authLoading || pageLoading) {
    return (
      <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'60vh' }}>
        <p style={{ color:'#9a9a9a', fontSize:'0.9rem', letterSpacing:'0.08em' }}>
          {t('profile.loading')}
        </p>
      </div>
    );
  }

  // ── Form dùng chung ───────────────────────────────────────────────────────────
  const profileForm = (
    <form onSubmit={handleUpdateInfo} className="account-form">
      <div className="form-row two-cols">
        <div className="form-group">
          <label>{t('profile.name')}</label>
          <input
            type="text"
            value={formData.name}
            onChange={handleInputChange('name')}
            placeholder="Nguyễn Anh Đức"
          />
        </div>
        <div className="form-group">
          <label>{t('profile.phone')}</label>
          <input
            type="tel"
            inputMode="numeric"
            value={formData.phone}
            onChange={handleInputChange('phone')}
            placeholder="0908474355"
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Email</label>
          <input type="email" value={formData.email} disabled className="disabled-input" />
        </div>
      </div>

      <div className="address-block">
        <div className="address-block-title">{t('profile.address.default')}</div>
        <span className="form-hint address-block-hint">
          {t('profile.address.hint')}
        </span>

        <div className="form-row">
          <div className="form-group">
            <label>Tỉnh / Thành phố</label>
            <select value={selectedProvince.id || ''} onChange={handleProvinceChange}>
              <option value="">{t('profile.selectProvince')}</option>
              {provinces.map((p) => (
                <option key={p.provinceId} value={p.provinceId}>{p.provinceName}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row two-cols">
          <div className="form-group">
            <label>Quận / Huyện</label>
            <select
              value={selectedDistrict.id || ''}
              onChange={handleDistrictChange}
              disabled={!districts.length}
            >
              <option value="">{t('profile.selectDistrict')}</option>
              {districts.map((d) => (
                <option key={d.districtId} value={d.districtId}>{d.districtName}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Phường / Xã</label>
            <select
              value={selectedWard.code || ''}
              onChange={handleWardChange}
              disabled={!wards.length}
            >
              <option value="">{t('profile.selectWard')}</option>
              {wards.map((w) => (
                <option key={w.wardCode} value={w.wardCode}>{w.wardName}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>{t('profile.street')}</label>
            <input
              type="text"
              value={formData.specificAddress}
              onChange={handleInputChange('specificAddress')}
              placeholder="76 Nguyễn Sơn"
            />
          </div>
        </div>

        <div className="address-preview">
          <strong>{t('profile.fullAddress')}</strong> {fullAddressPreview || t('profile.noAddress')}
        </div>
      </div>

      <button type="submit" className="btn-update" disabled={isUpdating}>
        {isUpdating ? t('profile.saving') : t('profile.save')}
      </button>
    </form>
  );

  // ── Admin layout ──────────────────────────────────────────────────────────────
  if (isAdminUser) {
    return (
      <div className="admin-profile-section">
        <div className="admin-profile-wrap">
          {successMessage && (
            <div className="success-message">✓ {successMessage}</div>
          )}
          <div className="admin-profile-card">
            <h2>{t('profile.heading')}</h2>
            {profileForm}
            <div className="admin-profile-back-wrap">
              <button
                type="button"
                className="btn-back-dashboard"
                onClick={() => navigate('/admin')}
              >
                {t('profile.backDashboard')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── User layout ───────────────────────────────────────────────────────────────
  return (
    <section className="account-page-container">
      <header className="account-page-heading">
        <p>THEBOB / {t('profile.account.heading').toLocaleUpperCase(dateLocale)}</p>
        <h1>{t('profile.account.heading')}</h1>
        <span>{t('profile.account.description')}</span>
      </header>
      <div className="account-page">

        {/* Sidebar */}
        <aside className="account-sidebar">
          <div className="sidebar-header">{t('profile.account.heading')}</div>

          <div className="sidebar-avatar">
            <div className="avatar-circle">{getInitials(formData.name)}</div>
            <div className="sidebar-avatar-info">
              <span className="avatar-name">{formData.name || t('profile.member')}</span>
              <span className="avatar-email">{formData.email}</span>
            </div>
          </div>

          <nav className="sidebar-menu">
            <button
              type="button"
              className={`menu-item ${activeMenu === 'account' ? 'active' : ''}`}
              onClick={() => setActiveMenu('account')}
            >
              <IconUser className="menu-icon" size={19} stroke={1.7} aria-hidden="true" />
              <span>{t('profile.menu.info')}</span>
            </button>
            <button
              type="button"
              className={`menu-item ${activeMenu === 'orders' ? 'active' : ''}`}
              onClick={() => setActiveMenu('orders')}
            >
              <IconPackage className="menu-icon" size={19} stroke={1.7} aria-hidden="true" />
              <span>{t('profile.menu.orders')}</span>
            </button>
            <button
              type="button"
              className="menu-item"
              onClick={() => navigate('/user/vouchers')}
            >
              <IconTicket className="menu-icon" size={19} stroke={1.7} aria-hidden="true" />
              <span>{t('profile.menu.vouchers')}</span>
            </button>
            <button
              type="button"
              className={`menu-item ${activeMenu === 'password' ? 'active' : ''}`}
              onClick={() => setActiveMenu('password')}
            >
              <IconLock className="menu-icon" size={19} stroke={1.7} aria-hidden="true" />
              <span>{t('profile.menu.password')}</span>
            </button>
            <button type="button" className="menu-item logout" onClick={handleLogout}>
              <IconLogout className="menu-icon" size={19} stroke={1.7} aria-hidden="true" />
              <span>{t('profile.menu.logout')}</span>
            </button>
          </nav>
        </aside>

        {/* Main */}
        <main className="account-main">

          {/* TAB: Thông tin */}
          {activeMenu === 'account' && (
            <div className="account-section">
              <p className="account-section-title">{t('profile.section.profile')}</p>
              <h2>{t('profile.section.account')}</h2>
              {successMessage && (
                <div className="success-message">✓ {successMessage}</div>
              )}
              {profileForm}
            </div>
          )}

          {/* TAB: Đơn hàng */}
          {activeMenu === 'orders' && (
            <div className="account-section">
              <p className="account-section-title">{t('profile.section.history')}</p>
              <h2>{t('profile.section.orders')}</h2>

              {ordersLoading ? (
                <p style={{ color:'#9a9a9a', fontSize:'0.85rem', letterSpacing:'0.06em' }}>
                  {t('profile.orders.loading')}
                </p>
              ) : userOrders.length === 0 ? (
                <div className="orders-empty-state">
                  <span className="empty-icon"><IconShoppingBag size={36} stroke={1.4} aria-hidden="true" /></span>
                  <p>{t('profile.orders.empty')}</p>
                  <button className="btn-shop-now" onClick={() => navigate('/products')}>
                    {t('profile.shopNow')}
                  </button>
                </div>
              ) : (
                <div className="orders-history-list">
                  {userOrders.map((order) => {
                    const st = STATUS_MAP[order.status] ?? { label: order.status, cls: 'pending' };
                    return (
                      <div key={order.id} className="order-history-card">
                        <div className="order-history-header">
                          <div className="order-header-info">
                            <span className="order-id">#{order.id}</span>
                            <span className="order-date">
                              {new Date(order.createdAt).toLocaleDateString(dateLocale, {
                                day: '2-digit', month: '2-digit', year: 'numeric',
                              })}
                            </span>
                          </div>
                          <span className={`status-badge ${st.cls}`}>{STATUS_MAP[order.status] ? t(st.label) : st.label}</span>
                        </div>

                        <div className="order-history-items-container">
                          <table className="order-history-items-table">
                            <thead>
                              <tr>
                                <th>{t('profile.table.product')}</th>
                                <th style={{ textAlign:'center' }}>{t('profile.table.size')}</th>
                                <th style={{ textAlign:'center' }}>{t('profile.table.color')}</th>
                                <th style={{ textAlign:'right' }}>{t('profile.table.price')}</th>
                                <th style={{ textAlign:'center' }}>{t('profile.table.quantity')}</th>
                                <th style={{ textAlign:'right' }}>{t('profile.table.total')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {order.items?.map((item) => (
                                <tr key={item.id}>
                                  <td className="order-item-prod-cell">
                                    {item.imageUrl && (
                                      <img src={item.imageUrl} alt={item.productName} className="order-item-thumb" />
                                    )}
                                    <span className="order-item-name">{item.productName}</span>
                                  </td>
                                  <td style={{ textAlign:'center' }} className="order-item-meta-cell">{item.size || '—'}</td>
                                  <td style={{ textAlign:'center' }} className="order-item-meta-cell">{item.color || '—'}</td>
                                  <td style={{ textAlign:'right' }}>{item.price?.toLocaleString('vi-VN')} đ</td>
                                  <td style={{ textAlign:'center' }}>{item.quantity}</td>
                                  <td style={{ textAlign:'right', fontWeight:'700' }}>
                                    {(item.price * item.quantity)?.toLocaleString('vi-VN')} đ
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="order-history-footer">
                          <div className="order-footer-summary">
                            <span className="order-shipping-label">
                              {t('profile.shipping')}{' '}
                              {order.shippingAmount === 0
                                ? t('profile.free')
                                : `${order.shippingAmount?.toLocaleString('vi-VN')} đ`}
                            </span>
                            <span className="order-footer-total">
                              {t('profile.total')} <strong>{order.totalAmount?.toLocaleString(dateLocale)} đ</strong>
                            </span>
                          </div>
                          <button className="btn-view-detail" onClick={() => navigate(`/orders/${order.id}`)}>
                            {t('profile.viewDetails')}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB: Mật khẩu */}
          {activeMenu === 'password' && (
            <div className="account-section">
              <p className="account-section-title">{t('profile.section.security')}</p>
              <h2>{t('profile.password.title')}</h2>
              {successMessage && (
                <div className="success-message">✓ {successMessage}</div>
              )}
              <p className="password-section-note">
                {t('profile.password.note')}
              </p>
              <form onSubmit={handleChangePassword} className="account-form">
                <div className="form-group">
                  <label>{t('profile.password.current')}</label>
                  <input type="password" placeholder="••••••••" />
                </div>
                <div className="form-group">
                  <label>{t('profile.password.new')}</label>
                  <input type="password" placeholder="••••••••" />
                </div>
                <div className="form-group">
                  <label>{t('profile.password.confirm')}</label>
                  <input type="password" placeholder="••••••••" />
                </div>
                <button type="submit" className="btn-update">{t('profile.password.update')}</button>
              </form>
            </div>
          )}

        </main>
      </div>
    </section>
  );
}
