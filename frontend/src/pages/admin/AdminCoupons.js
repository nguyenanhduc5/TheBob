import { useState, useEffect, useCallback, useMemo } from 'react';
import { couponsAPI, productsAPI } from '../../api/app';
import { useNotification } from '../../context/NotificationContext';
import { usePreferences } from '../../context/PreferencesContext';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import '../../styles/AdminCategories.css'; // Dùng chung style với Categories cho nhanh

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const { addNotification } = useNotification();
  const { t, locale } = usePreferences();
  const dateLocale = { vi: 'vi-VN', en: 'en-US', zh: 'zh-CN' }[locale];
  const [formData, setFormData] = useState({
    code: '',
    discountPercent: 10,
    expiryDate: '',
    usageLimit: 100,
    productId: ''
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [couponData, productData] = await Promise.all([
        couponsAPI.getAll(),
        productsAPI.getProducts()
      ]);
      setCoupons(couponData);
      setProducts(productData);
    } catch (error) {
      addNotification(t('admin.coupons.loadError'), 'error');
    } finally {
      setLoading(false);
    }
  }, [addNotification, t]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const productMap = useMemo(() => {
    return new Map(products.map(p => [String(p.id), p.name]));
  }, [products]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.code || formData.discountPercent <= 0) {
      addNotification(t('admin.coupons.validation'), 'warning');
      return;
    }
    try {
      const payload = {
        ...formData,
        productId: formData.productId ? parseInt(formData.productId) : null
      };
      await couponsAPI.create(payload);
      addNotification(t('admin.coupons.createdNotice'), 'success');
      setShowForm(false);
      setFormData({ code: '', discountPercent: 10, expiryDate: '', usageLimit: 100, productId: '' });
      fetchData();
    } catch (error) {
      addNotification(error.message || t('admin.coupons.createError'), 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('admin.coupons.confirmDelete'))) return;
    try {
      await couponsAPI.delete(id);
      addNotification(t('admin.coupons.deleted'), 'success');
      fetchData();
    } catch (error) {
      addNotification(t('admin.coupons.deleteError'), 'error');
    }
  };

  if (loading) return <LoadingSkeleton type="table" />;

  return (
    <div className="admin-categories-page">
      <div className="admin-header">
        <h1>{t('admin.coupons.title')}</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-add-category">
          {showForm ? t('admin.coupons.back') : t('admin.coupons.create')}
        </button>
      </div>

      {showForm ? (
        <form onSubmit={handleSubmit} className="category-form">
          <div className="form-group">
            <label>{t('admin.coupons.code')}</label>
            <input 
              type="text" 
              value={formData.code} 
              onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})}
              required 
            />
          </div>
          <div className="form-group">
            <label>{t('admin.coupons.discount')}</label>
            <input 
              type="number" 
              min="1"
              max="100"
              value={formData.discountPercent} 
              onChange={e => setFormData({...formData, discountPercent: parseInt(e.target.value) || 0})}
              required 
            />
          </div>
          <div className="form-group">
            <label>{t('admin.coupons.expiry')}</label>
            <input 
              type="date" 
              value={formData.expiryDate} 
              onChange={e => setFormData({...formData, expiryDate: e.target.value})}
            />
          </div>
          <div className="form-group">
            <label>{t('admin.coupons.usage')}</label>
            <input 
              type="number" 
              min="1"
              value={formData.usageLimit} 
              onChange={e => setFormData({...formData, usageLimit: parseInt(e.target.value) || 0})}
              required 
            />
          </div>
          <div className="form-group">
            <label>{t('admin.coupons.product')}</label>
            <select 
              value={formData.productId} 
              onChange={e => setFormData({...formData, productId: e.target.value})}
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
            >
              <option value="">{t('admin.coupons.allProducts')}</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-save">{t('admin.coupons.save')}</button>
        </form>
      ) : (
        <div className="categories-list-section">
          <div className="categories-grid">
            {coupons.map(coupon => (
              <div key={coupon.id} className="category-card">
                <div className="category-content">
                  <h3>{coupon.code}</h3>
                  <p>{t('admin.coupons.discountLabel')} {coupon.discountPercent}%</p>
                  <p>{t('admin.coupons.applyLabel')} {coupon.productId ? (productMap.get(String(coupon.productId)) || `#${coupon.productId}`) : t('admin.coupons.allStore')}</p>
                  <p>{t('admin.coupons.limit')} {coupon.usageLimit} {t('admin.coupons.uses')}</p>
                  <p>{t('admin.coupons.expired')} {coupon.expiryDate ? new Date(coupon.expiryDate).toLocaleDateString(dateLocale) : t('admin.coupons.noExpiry')}</p>
                </div>
                <button onClick={() => handleDelete(coupon.id)} className="btn-delete">{t('admin.categories.delete')}</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
