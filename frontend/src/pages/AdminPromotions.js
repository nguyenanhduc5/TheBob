import { useState, useEffect, useCallback, useRef } from 'react';
import { promotionsAPI, usersAPI, categoriesAPI, brandsAPI, productsAPI } from '../api/app';
import { useNotification } from '../context/NotificationContext';
import '../styles/AdminPromotions.css';

const PROMO_TYPES = [
  { value: 'Automatic', label: '⚡ Automatic (Tự động)' },
  { value: 'Coupon', label: '🎟️ Coupon (Nhập mã)' },
  { value: 'FlashSale', label: '🔥 Flash Sale' },
  { value: 'Voucher', label: '🎁 Voucher (Cá nhân)' },
  { value: 'Member', label: '👑 Member (Thành viên)' },
  { value: 'Birthday', label: '🎂 Birthday (Sinh nhật)' },
];

const DISCOUNT_KINDS = [
  { value: 'Percentage', label: '% Phần trăm' },
  { value: 'FixedAmount', label: '₫ Số tiền cố định' },
  { value: 'FreeShipping', label: '🚚 Miễn phí ship' },
  { value: 'BuyXGetY', label: '🎁 Mua X tặng Y' },
  { value: 'BundlePrice', label: '📦 Giá Combo' },
];

const SCOPES = [
  { value: 'AllShop', label: '🏪 Toàn shop' },
  { value: 'Product', label: '📦 Theo sản phẩm' },
  { value: 'Category', label: '📁 Theo danh mục' },
  { value: 'Brand', label: '🏷️ Theo thương hiệu' },
  { value: 'CustomerGroup', label: '👥 Theo nhóm khách' },
];

const STATUS_COLORS = {
  Active: '#10b981', Draft: '#6b7280', Paused: '#f59e0b', Ended: '#ef4444'
};

const emptyForm = {
  name: '', description: '', bannerUrl: '', type: 'Automatic', status: 'Draft',
  priority: 20, isStackable: false, maxStackCount: 0, exclusiveGroup: '',
  discountType: 'Percentage', discountValue: 10, maxDiscountAmount: '',
  minOrderValue: 0, maxOrderValue: '', minQuantity: 0,
  startDate: new Date().toISOString().slice(0,16),
  endDate: new Date(Date.now() + 30*24*60*60*1000).toISOString().slice(0,16),
  usageLimitTotal: 0, usageLimitPerUser: 1, usageLimitPerDay: 0, usageLimitPerMonth: 0,
  scope: 'AllShop', couponCode: '', isPersonal: false,
  requiresNewUser: false, requiresCustomerGroup: false, requiresBirthdayUser: false,
  buyQuantity: 0, getQuantity: 0,
  productIds: [], categoryIds: [], brandIds: [], customerGroupIds: [],
  excludedProductIds: [], excludedCategoryIds: [], excludedBrandIds: [],
};

export default function AdminPromotions() {
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // list | form | stats
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [sendCouponModal, setSendCouponModal] = useState(null); // promotionId
  const [sendEmail, setSendEmail] = useState('');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [customerGroups, setCustomerGroups] = useState([]);
  const { addNotification } = useNotification();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [promos, prods, cats, brnds, groups] = await Promise.all([
        promotionsAPI.getAll({ status: filterStatus, type: filterType }),
        productsAPI.getProducts(),
        categoriesAPI.getAll(),
        brandsAPI.getAll(),
        promotionsAPI.getCustomerGroups(),
      ]);
      setPromotions(promos.items || []);
      setProducts(prods || []);
      setCategories(cats || []);
      setBrands(brnds || []);
      setCustomerGroups(groups || []);
    } catch {
      addNotification('Lỗi tải dữ liệu', 'error');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterType, addNotification]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openCreate = () => { setEditId(null); setForm(emptyForm); setView('form'); };

  const openEdit = async (id) => {
    try {
      const data = await promotionsAPI.getById(id);
      setForm({
        ...emptyForm, ...data,
        startDate: data.startDate?.slice(0,16) || emptyForm.startDate,
        endDate: data.endDate?.slice(0,16) || emptyForm.endDate,
        maxDiscountAmount: data.maxDiscountAmount ?? '',
        maxOrderValue: data.maxOrderValue ?? '',
      });
      setEditId(id);
      setView('form');
    } catch { addNotification('Lỗi tải chi tiết', 'error'); }
  };

  const openStats = async () => {
    setView('stats');
    setStatsLoading(true);
    try {
      const data = await promotionsAPI.getStatsSummary();
      setStats(data);
    } catch { addNotification('Lỗi tải thống kê', 'error'); }
    finally { setStatsLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        discountValue: parseFloat(form.discountValue) || 0,
        minOrderValue: parseFloat(form.minOrderValue) || 0,
        maxDiscountAmount: form.maxDiscountAmount ? parseFloat(form.maxDiscountAmount) : null,
        maxOrderValue: form.maxOrderValue ? parseFloat(form.maxOrderValue) : null,
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
      };
      if (editId) {
        await promotionsAPI.update(editId, payload);
        addNotification('Đã cập nhật Promotion', 'success');
      } else {
        await promotionsAPI.create(payload);
        addNotification('Đã tạo Promotion mới', 'success');
      }
      setView('list');
      fetchAll();
    } catch (err) {
      addNotification(err.message || 'Lỗi lưu Promotion', 'error');
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await promotionsAPI.updateStatus(id, status);
      addNotification(`Đã chuyển trạng thái: ${status}`, 'success');
      fetchAll();
    } catch { addNotification('Lỗi cập nhật trạng thái', 'error'); }
  };

  const handleClone = async (id) => {
    try {
      await promotionsAPI.clone(id);
      addNotification('Đã clone Promotion', 'success');
      fetchAll();
    } catch { addNotification('Lỗi clone', 'error'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Xóa hoặc kết thúc Promotion này?')) return;
    try {
      await promotionsAPI.delete(id);
      addNotification('Đã xóa/kết thúc Promotion', 'success');
      fetchAll();
    } catch { addNotification('Lỗi xóa', 'error'); }
  };

  const handleSendCoupon = async () => {
    if (!sendEmail.trim()) return;
    try {
      // Find user by email
      const user = await usersAPI.findByEmail(sendEmail.trim());
      await promotionsAPI.sendUserCoupon({ promotionId: sendCouponModal, userId: user.id });
      addNotification(`Đã gửi voucher đến ${sendEmail}`, 'success');
      setSendCouponModal(null);
      setSendEmail('');
    } catch (err) {
      addNotification(err.message || 'Lỗi gửi voucher', 'error');
    }
  };

  const f = (key, val) => setForm(prev => ({ ...prev, [key]: val }));
  const toggleArr = (key, id) => setForm(prev => ({
    ...prev,
    [key]: prev[key].includes(id) ? prev[key].filter(x => x !== id) : [...prev[key], id]
  }));

  if (loading) return <div className="ap-loading">⏳ Đang tải...</div>;

  return (
    <div className="ap-page">
      {/* Header */}
      <div className="ap-header">
        <div>
          <h1>🎯 Quản lý Promotion</h1>
          <p className="ap-subtitle">{promotions.length} chương trình khuyến mãi</p>
        </div>
        <div className="ap-header-actions">
          <button className="ap-btn ap-btn-ghost" onClick={openStats}>📊 Thống kê</button>
          <button className="ap-btn ap-btn-primary" onClick={openCreate}>+ Tạo mới</button>
        </div>
      </div>

      {/* Filter Bar */}
      {view === 'list' && (
        <div className="ap-filters">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Tất cả trạng thái</option>
            <option value="Active">Active</option>
            <option value="Draft">Draft</option>
            <option value="Paused">Paused</option>
            <option value="Ended">Ended</option>
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">Tất cả loại</option>
            {PROMO_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <button className="ap-btn ap-btn-ghost" onClick={fetchAll}>🔄 Làm mới</button>
        </div>
      )}

      {/* Stats View */}
      {view === 'stats' && (
        <div className="ap-stats">
          <button className="ap-btn ap-btn-ghost mb-3" onClick={() => setView('list')}>← Quay lại</button>
          {statsLoading ? <p>Đang tải thống kê...</p> : stats && (
            <>
              <div className="ap-stats-cards">
                <div className="ap-stat-card">
                  <span className="ap-stat-label">Tổng tiền đã giảm</span>
                  <span className="ap-stat-value">{stats.totalDiscountGiven?.toLocaleString('vi-VN')}₫</span>
                </div>
                <div className="ap-stat-card">
                  <span className="ap-stat-label">Đơn có khuyến mãi</span>
                  <span className="ap-stat-value">{stats.totalOrdersWithPromotion}</span>
                </div>
              </div>
              <h3 className="ap-section-title">Top Promotions</h3>
              <table className="ap-table">
                <thead><tr><th>Tên</th><th>Lượt dùng</th><th>Tiền giảm</th><th>Đơn hàng</th></tr></thead>
                <tbody>
                  {stats.topPromotions?.map(p => (
                    <tr key={p.promotionId}>
                      <td>{p.name}</td>
                      <td>{p.totalUsages}</td>
                      <td>{p.totalDiscountGiven?.toLocaleString('vi-VN')}₫</td>
                      <td>{p.totalOrders}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {/* Form View */}
      {view === 'form' && (
        <div className="ap-form-container">
          <div className="ap-form-header">
            <button className="ap-btn ap-btn-ghost" onClick={() => setView('list')}>← Quay lại</button>
            <h2>{editId ? '✏️ Chỉnh sửa' : '✨ Tạo Promotion mới'}</h2>
          </div>

          <form onSubmit={handleSubmit} className="ap-form">
            {/* Thông tin cơ bản */}
            <section className="ap-section">
              <h3>📋 Thông tin cơ bản</h3>
              <div className="ap-grid-2">
                <div className="ap-field">
                  <label>Tên chương trình *</label>
                  <input required value={form.name} onChange={e => f('name', e.target.value)} placeholder="VD: Summer Sale 2026" />
                </div>
                <div className="ap-field">
                  <label>Loại Promotion</label>
                  <select value={form.type} onChange={e => f('type', e.target.value)}>
                    {PROMO_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="ap-field">
                <label>Mô tả</label>
                <textarea value={form.description} onChange={e => f('description', e.target.value)} rows={2} />
              </div>
              <div className="ap-grid-3">
                <div className="ap-field">
                  <label>Trạng thái</label>
                  <select value={form.status} onChange={e => f('status', e.target.value)}>
                    <option value="Draft">Draft</option>
                    <option value="Active">Active</option>
                    <option value="Paused">Paused</option>
                  </select>
                </div>
                <div className="ap-field">
                  <label>Ngày bắt đầu</label>
                  <input type="datetime-local" value={form.startDate} onChange={e => f('startDate', e.target.value)} />
                </div>
                <div className="ap-field">
                  <label>Ngày kết thúc</label>
                  <input type="datetime-local" value={form.endDate} onChange={e => f('endDate', e.target.value)} />
                </div>
              </div>
            </section>

            {/* Kiểu giảm giá */}
            <section className="ap-section">
              <h3>💰 Kiểu giảm giá</h3>
              <div className="ap-grid-3">
                <div className="ap-field">
                  <label>Kiểu</label>
                  <select value={form.discountType} onChange={e => f('discountType', e.target.value)}>
                    {DISCOUNT_KINDS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
                <div className="ap-field">
                  <label>{form.discountType === 'Percentage' ? 'Phần trăm (%)' : form.discountType === 'FreeShipping' ? 'N/A' : 'Số tiền (₫)'}</label>
                  <input type="number" min={0} value={form.discountValue} onChange={e => f('discountValue', e.target.value)} disabled={form.discountType === 'FreeShipping'} />
                </div>
                <div className="ap-field">
                  <label>Trần giảm tối đa (₫, bỏ trống = không giới hạn)</label>
                  <input type="number" min={0} value={form.maxDiscountAmount} onChange={e => f('maxDiscountAmount', e.target.value)} placeholder="Không giới hạn" />
                </div>
              </div>
              {form.type === 'Coupon' && (
                <div className="ap-field">
                  <label>Mã Coupon Code</label>
                  <input value={form.couponCode} onChange={e => f('couponCode', e.target.value.toUpperCase())} placeholder="VD: SAVE20" style={{ letterSpacing: '2px', fontWeight: 700 }} />
                </div>
              )}
              {form.discountType === 'BuyXGetY' && (
                <div className="ap-grid-2">
                  <div className="ap-field"><label>Mua bao nhiêu sản phẩm (X)</label><input type="number" min={1} value={form.buyQuantity} onChange={e => f('buyQuantity', parseInt(e.target.value))} /></div>
                  <div className="ap-field"><label>Tặng bao nhiêu sản phẩm (Y)</label><input type="number" min={1} value={form.getQuantity} onChange={e => f('getQuantity', parseInt(e.target.value))} /></div>
                </div>
              )}
            </section>

            {/* Điều kiện */}
            <section className="ap-section">
              <h3>📋 Điều kiện áp dụng</h3>
              <div className="ap-grid-3">
                <div className="ap-field"><label>Đơn tối thiểu (₫)</label><input type="number" min={0} value={form.minOrderValue} onChange={e => f('minOrderValue', e.target.value)} /></div>
                <div className="ap-field"><label>Đơn tối đa (₫, bỏ trống = không giới hạn)</label><input type="number" min={0} value={form.maxOrderValue} onChange={e => f('maxOrderValue', e.target.value)} placeholder="Không giới hạn" /></div>
                <div className="ap-field"><label>Số lượng sp tối thiểu</label><input type="number" min={0} value={form.minQuantity} onChange={e => f('minQuantity', parseInt(e.target.value))} /></div>
              </div>
              <div className="ap-checkboxes">
                <label><input type="checkbox" checked={form.requiresNewUser} onChange={e => f('requiresNewUser', e.target.checked)} /> Chỉ khách mới</label>
                <label><input type="checkbox" checked={form.requiresBirthdayUser} onChange={e => f('requiresBirthdayUser', e.target.checked)} /> Chỉ sinh nhật tháng này</label>
                <label><input type="checkbox" checked={form.requiresCustomerGroup} onChange={e => f('requiresCustomerGroup', e.target.checked)} /> Chỉ nhóm khách VIP</label>
              </div>
            </section>

            {/* Giới hạn sử dụng */}
            <section className="ap-section">
              <h3>🔢 Giới hạn sử dụng</h3>
              <div className="ap-grid-4">
                <div className="ap-field"><label>Tổng lượt (0 = không giới hạn)</label><input type="number" min={0} value={form.usageLimitTotal} onChange={e => f('usageLimitTotal', parseInt(e.target.value))} /></div>
                <div className="ap-field"><label>Mỗi user (0 = không giới hạn)</label><input type="number" min={0} value={form.usageLimitPerUser} onChange={e => f('usageLimitPerUser', parseInt(e.target.value))} /></div>
                <div className="ap-field"><label>Mỗi ngày</label><input type="number" min={0} value={form.usageLimitPerDay} onChange={e => f('usageLimitPerDay', parseInt(e.target.value))} /></div>
                <div className="ap-field"><label>Mỗi tháng</label><input type="number" min={0} value={form.usageLimitPerMonth} onChange={e => f('usageLimitPerMonth', parseInt(e.target.value))} /></div>
              </div>
            </section>

            {/* Stacking + Priority */}
            <section className="ap-section">
              <h3>⚖️ Priority & Stacking</h3>
              <div className="ap-grid-3">
                <div className="ap-field"><label>Priority (cao hơn = ưu tiên hơn)</label><input type="number" value={form.priority} onChange={e => f('priority', parseInt(e.target.value))} /></div>
                <div className="ap-field"><label>Exclusive Group (cùng group chỉ áp 1)</label><input value={form.exclusiveGroup} onChange={e => f('exclusiveGroup', e.target.value)} placeholder="VD: shipping, flash" /></div>
                <div className="ap-field"><label>Max Stack Count (0 = không giới hạn)</label><input type="number" min={0} value={form.maxStackCount} onChange={e => f('maxStackCount', parseInt(e.target.value))} /></div>
              </div>
              <label className="ap-toggle">
                <input type="checkbox" checked={form.isStackable} onChange={e => f('isStackable', e.target.checked)} />
                <span>Có thể cộng dồn (IsStackable)</span>
              </label>
            </section>

            {/* Phạm vi áp dụng */}
            <section className="ap-section">
              <h3>🎯 Phạm vi áp dụng</h3>
              <div className="ap-field">
                <label>Scope</label>
                <div className="ap-scope-buttons">
                  {SCOPES.map(s => (
                    <button type="button" key={s.value} className={`ap-scope-btn ${form.scope === s.value ? 'active' : ''}`} onClick={() => f('scope', s.value)}>{s.label}</button>
                  ))}
                </div>
              </div>
              {form.scope === 'Product' && (
                <div className="ap-field">
                  <label>Sản phẩm áp dụng:</label>
                  <div className="ap-tag-grid">
                    {products.map(p => <label key={p.id} className={`ap-tag ${form.productIds.includes(p.id) ? 'selected' : ''}`}><input type="checkbox" checked={form.productIds.includes(p.id)} onChange={() => toggleArr('productIds', p.id)} />{p.name}</label>)}
                  </div>
                </div>
              )}
              {form.scope === 'Category' && (
                <div className="ap-field">
                  <label>Danh mục áp dụng:</label>
                  <div className="ap-tag-grid">
                    {categories.map(c => <label key={c.id} className={`ap-tag ${form.categoryIds.includes(c.id) ? 'selected' : ''}`}><input type="checkbox" checked={form.categoryIds.includes(c.id)} onChange={() => toggleArr('categoryIds', c.id)} />{c.name}</label>)}
                  </div>
                </div>
              )}
              {form.scope === 'Brand' && (
                <div className="ap-field">
                  <label>Thương hiệu áp dụng:</label>
                  <div className="ap-tag-grid">
                    {brands.map(b => <label key={b.id} className={`ap-tag ${form.brandIds.includes(b.id) ? 'selected' : ''}`}><input type="checkbox" checked={form.brandIds.includes(b.id)} onChange={() => toggleArr('brandIds', b.id)} />{b.name}</label>)}
                  </div>
                </div>
              )}
              {form.scope === 'CustomerGroup' && (
                <div className="ap-field">
                  <label>Nhóm khách hàng:</label>
                  <div className="ap-tag-grid">
                    {customerGroups.map(g => <label key={g.id} className={`ap-tag ${form.customerGroupIds.includes(g.id) ? 'selected' : ''}`}><input type="checkbox" checked={form.customerGroupIds.includes(g.id)} onChange={() => toggleArr('customerGroupIds', g.id)} />{g.name}</label>)}
                  </div>
                </div>
              )}
            </section>

            <div className="ap-form-actions">
              <button type="button" className="ap-btn ap-btn-ghost" onClick={() => setView('list')}>Hủy</button>
              <button type="submit" className="ap-btn ap-btn-primary">
                {editId ? '💾 Lưu thay đổi' : '✨ Tạo Promotion'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <div className="ap-list">
          {promotions.length === 0 && <div className="ap-empty">Chưa có chương trình nào. <button className="ap-link" onClick={openCreate}>Tạo ngay →</button></div>}
          {promotions.map(p => (
            <div key={p.id} className={`ap-card ${p.status.toLowerCase()}`}>
              <div className="ap-card-main">
                <div className="ap-card-info">
                  <span className="ap-badge" style={{ background: STATUS_COLORS[p.status] }}>{p.status}</span>
                  <span className="ap-type-badge">{PROMO_TYPES.find(t => t.value === p.type)?.label || p.type}</span>
                  <h3 className="ap-card-name">{p.name}</h3>
                  <div className="ap-card-meta">
                    <span>🎯 {p.discountType === 'Percentage' ? `${p.discountValue}%` : p.discountType === 'FixedAmount' ? `${p.discountValue.toLocaleString('vi-VN')}₫` : p.discountType}</span>
                    {p.couponCode && <span>🎟️ {p.couponCode}</span>}
                    <span>📊 {p.usedCount} lượt dùng</span>
                    <span>🏆 Priority: {p.priority}</span>
                    <span>📅 {new Date(p.endDate).toLocaleDateString('vi-VN')}</span>
                  </div>
                </div>
                <div className="ap-card-actions">
                  <button className="ap-btn ap-btn-sm" onClick={() => openEdit(p.id)}>✏️ Sửa</button>
                  <button className="ap-btn ap-btn-sm ap-btn-ghost" onClick={() => handleClone(p.id)}>📋 Clone</button>
                  {p.status === 'Active' && <button className="ap-btn ap-btn-sm ap-btn-warning" onClick={() => handleStatusChange(p.id, 'Paused')}>⏸ Dừng</button>}
                  {(p.status === 'Draft' || p.status === 'Paused') && <button className="ap-btn ap-btn-sm ap-btn-success" onClick={() => handleStatusChange(p.id, 'Active')}>▶ Kích hoạt</button>}
                  {p.type === 'Voucher' && <button className="ap-btn ap-btn-sm ap-btn-purple" onClick={() => setSendCouponModal(p.id)}>📤 Gửi User</button>}
                  <button className="ap-btn ap-btn-sm ap-btn-danger" onClick={() => handleDelete(p.id)}>🗑</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Send Coupon Modal */}
      {sendCouponModal && (
        <div className="ap-modal-overlay" onClick={() => setSendCouponModal(null)}>
          <div className="ap-modal" onClick={e => e.stopPropagation()}>
            <h3>📤 Gửi Voucher cho User</h3>
            <div className="ap-field">
              <label>Email người dùng</label>
              <input type="email" value={sendEmail} onChange={e => setSendEmail(e.target.value)} placeholder="user@example.com" autoFocus />
            </div>
            <div className="ap-modal-actions">
              <button className="ap-btn ap-btn-ghost" onClick={() => setSendCouponModal(null)}>Hủy</button>
              <button className="ap-btn ap-btn-primary" onClick={handleSendCoupon}>Gửi Voucher</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
