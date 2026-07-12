// src/pages/AdminSettings.jsx
import { useState, useEffect, useCallback } from 'react';
import { useNotification } from '../context/NotificationContext';
import { getSettings, saveSettings } from '../services/settingsService';
import '../styles/AdminSettings.css';

const TABS = [
  { key: 'store', label: 'Thông Tin Cửa Hàng' },
  { key: 'payment', label: 'Thanh Toán (SePay)' },
  { key: 'shipping', label: 'Vận Chuyển' },
];

export default function AdminSettings() {
  const { addNotification } = useNotification();
  const [activeTab, setActiveTab] = useState('store');
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const data = await getSettings();
      if (mounted) {
        setSettings(data);
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const updateField = useCallback((section, field, value) => {
    setSettings((prev) => ({
      ...prev,
      [section]: { ...prev[section], [field]: value },
    }));
  }, []);

  const handleSave = async (section) => {
    setSaving(true);
    try {
      await saveSettings(section, settings[section]);
      addNotification('Đã lưu cài đặt thành công!', 'success');
    } catch (error) {
      addNotification(error?.message || 'Lưu cài đặt thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ---- Vận chuyển: quản lý danh sách khu vực ----
  const addRegion = () => {
    setSettings((prev) => ({
      ...prev,
      shipping: {
        ...prev.shipping,
        regions: [...prev.shipping.regions, { name: '', fee: 0 }],
      },
    }));
  };

  const updateRegion = (index, field, value) => {
    setSettings((prev) => {
      const regions = [...prev.shipping.regions];
      regions[index] = { ...regions[index], [field]: value };
      return { ...prev, shipping: { ...prev.shipping, regions } };
    });
  };

  const removeRegion = (index) => {
    setSettings((prev) => ({
      ...prev,
      shipping: {
        ...prev.shipping,
        regions: prev.shipping.regions.filter((_, i) => i !== index),
      },
    }));
  };

  if (loading || !settings) {
    return <div className="settings-loading">Đang tải cài đặt...</div>;
  }

  return (
    <div className="admin-settings-page">
      <div className="settings-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`settings-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="settings-panel">
        {/* ---------------- TAB: THÔNG TIN CỬA HÀNG ---------------- */}
        {activeTab === 'store' && (
          <div className="settings-form">
            <h3>Thông Tin Cửa Hàng</h3>

            <div className="form-group">
              <label>Tên cửa hàng</label>
              <input
                type="text"
                value={settings.store.name}
                onChange={(e) => updateField('store', 'name', e.target.value)}
                placeholder="TheBob"
              />
            </div>

            <div className="form-group">
              <label>Logo URL</label>
              <input
                type="text"
                value={settings.store.logoUrl}
                onChange={(e) => updateField('store', 'logoUrl', e.target.value)}
                placeholder="https://..."
              />
              {settings.store.logoUrl && (
                <img src={settings.store.logoUrl} alt="Logo preview" className="logo-preview" />
              )}
            </div>

            <div className="form-group">
              <label>Địa chỉ</label>
              <input
                type="text"
                value={settings.store.address}
                onChange={(e) => updateField('store', 'address', e.target.value)}
                placeholder="Số nhà, đường, quận, thành phố"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Số điện thoại</label>
                <input
                  type="tel"
                  value={settings.store.phone}
                  onChange={(e) => updateField('store', 'phone', e.target.value)}
                  placeholder="0901234567"
                />
              </div>
              <div className="form-group">
                <label>Email liên hệ</label>
                <input
                  type="email"
                  value={settings.store.email}
                  onChange={(e) => updateField('store', 'email', e.target.value)}
                  placeholder="contact@thebob.vn"
                />
              </div>
            </div>

            <button className="btn-save-settings" onClick={() => handleSave('store')} disabled={saving}>
              {saving ? 'Đang lưu...' : 'Lưu Thông Tin Cửa Hàng'}
            </button>
          </div>
        )}

        {/* ---------------- TAB: THANH TOÁN ---------------- */}
        {activeTab === 'payment' && (
          <div className="settings-form">
            <h3>Cấu Hình Thanh Toán (SePay)</h3>
            <p className="settings-hint">
              Thông tin tài khoản ngân hàng dùng để tạo mã QR thanh toán qua SePay.
            </p>

            <div className="form-row">
              <div className="form-group">
                <label>Ngân hàng</label>
                <input
                  type="text"
                  value={settings.payment.bankName}
                  onChange={(e) => updateField('payment', 'bankName', e.target.value)}
                  placeholder="VD: MB Bank, Vietcombank..."
                />
              </div>
              <div className="form-group">
                <label>Số tài khoản</label>
                <input
                  type="text"
                  value={settings.payment.accountNumber}
                  onChange={(e) => updateField('payment', 'accountNumber', e.target.value)}
                  placeholder="0123456789"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Tên chủ tài khoản</label>
              <input
                type="text"
                value={settings.payment.accountName}
                onChange={(e) => updateField('payment', 'accountName', e.target.value)}
                placeholder="NGUYEN VAN A"
              />
            </div>

            <div className="form-group">
              <label>SePay API Token</label>
              <input
                type="password"
                value={settings.payment.sepayApiToken}
                onChange={(e) => updateField('payment', 'sepayApiToken', e.target.value)}
                placeholder="••••••••"
              />
              <span className="field-note">
                ⚠️ Token nhạy cảm — khi nối API thật, không nên lưu ở localStorage/frontend.
              </span>
            </div>

            <button className="btn-save-settings" onClick={() => handleSave('payment')} disabled={saving}>
              {saving ? 'Đang lưu...' : 'Lưu Cấu Hình Thanh Toán'}
            </button>
          </div>
        )}

        {/* ---------------- TAB: VẬN CHUYỂN ---------------- */}
        {activeTab === 'shipping' && (
          <div className="settings-form">
            <h3>Cấu Hình Vận Chuyển</h3>

            <div className="form-row">
              <div className="form-group">
                <label>Phí ship mặc định (VND)</label>
                <input
                  type="number"
                  min={0}
                  value={settings.shipping.baseFee}
                  onChange={(e) => updateField('shipping', 'baseFee', Number(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label>Miễn phí ship từ (VND)</label>
                <input
                  type="number"
                  min={0}
                  value={settings.shipping.freeShipThreshold}
                  onChange={(e) => updateField('shipping', 'freeShipThreshold', Number(e.target.value))}
                />
              </div>
            </div>

            <div className="form-group">
              <div className="regions-header">
                <label>Phí theo khu vực</label>
                <button type="button" className="btn-add-region" onClick={addRegion}>
                  + Thêm khu vực
                </button>
              </div>

              {settings.shipping.regions.length === 0 && (
                <p className="settings-hint">Chưa có khu vực nào. Nhấn "+ Thêm khu vực" để tạo mới.</p>
              )}

              {settings.shipping.regions.map((region, index) => (
                <div key={index} className="region-row">
                  <input
                    type="text"
                    placeholder="Tên khu vực (VD: Nội thành TP.HCM)"
                    value={region.name}
                    onChange={(e) => updateRegion(index, 'name', e.target.value)}
                  />
                  <input
                    type="number"
                    min={0}
                    placeholder="Phí (VND)"
                    value={region.fee}
                    onChange={(e) => updateRegion(index, 'fee', Number(e.target.value))}
                  />
                  <button
                    type="button"
                    className="btn-remove-region"
                    onClick={() => removeRegion(index)}
                    title="Xóa khu vực"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <button className="btn-save-settings" onClick={() => handleSave('shipping')} disabled={saving}>
              {saving ? 'Đang lưu...' : 'Lưu Cấu Hình Vận Chuyển'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}