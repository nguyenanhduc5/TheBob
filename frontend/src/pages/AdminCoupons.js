import { useState, useEffect, useCallback, useMemo } from 'react';
import { couponsAPI, productsAPI } from '../api/app';
import { useNotification } from '../context/NotificationContext';
import LoadingSkeleton from '../components/LoadingSkeleton';
import '../styles/AdminCategories.css'; // Dùng chung style với Categories cho nhanh

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const { addNotification } = useNotification();
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
      addNotification('Lỗi khi tải dữ liệu', 'error');
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

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
      addNotification('Vui lòng nhập mã và phần trăm giảm hợp lệ', 'warning');
      return;
    }
    try {
      const payload = {
        ...formData,
        productId: formData.productId ? parseInt(formData.productId) : null
      };
      await couponsAPI.create(payload);
      addNotification('Tạo mã giảm giá thành công', 'success');
      setShowForm(false);
      setFormData({ code: '', discountPercent: 10, expiryDate: '', usageLimit: 100, productId: '' });
      fetchData();
    } catch (error) {
      addNotification(error.message || 'Lỗi khi tạo mã', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Xóa mã giảm giá này?')) return;
    try {
      await couponsAPI.delete(id);
      addNotification('Đã xóa mã', 'success');
      fetchData();
    } catch (error) {
      addNotification('Lỗi khi xóa', 'error');
    }
  };

  if (loading) return <LoadingSkeleton type="table" />;

  return (
    <div className="admin-categories-page">
      <div className="admin-header">
        <h1>Quản Lý Mã Giảm Giá</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-add-category">
          {showForm ? '← Quay Lại' : '+ Tạo Mã Mới'}
        </button>
      </div>

      {showForm ? (
        <form onSubmit={handleSubmit} className="category-form">
          <div className="form-group">
            <label>Mã Code (VD: SAVE20)</label>
            <input 
              type="text" 
              value={formData.code} 
              onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})}
              required 
            />
          </div>
          <div className="form-group">
            <label>Phần trăm giảm (%)</label>
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
            <label>Ngày hết hạn</label>
            <input 
              type="date" 
              value={formData.expiryDate} 
              onChange={e => setFormData({...formData, expiryDate: e.target.value})}
            />
          </div>
          <div className="form-group">
            <label>Giới hạn sử dụng (lượt dùng tối đa)</label>
            <input 
              type="number" 
              min="1"
              value={formData.usageLimit} 
              onChange={e => setFormData({...formData, usageLimit: parseInt(e.target.value) || 0})}
              required 
            />
          </div>
          <div className="form-group">
            <label>Sản phẩm áp dụng (Để trống nếu áp dụng toàn sàn)</label>
            <select 
              value={formData.productId} 
              onChange={e => setFormData({...formData, productId: e.target.value})}
              style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
            >
              <option value="">Tất cả sản phẩm (Toàn sàn)</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-save">Lưu Mã</button>
        </form>
      ) : (
        <div className="categories-list-section">
          <div className="categories-grid">
            {coupons.map(coupon => (
              <div key={coupon.id} className="category-card">
                <div className="category-content">
                  <h3>{coupon.code}</h3>
                  <p>Giảm: {coupon.discountPercent}%</p>
                  <p>Áp dụng: {coupon.productId ? (productMap.get(String(coupon.productId)) || `Sản phẩm #${coupon.productId}`) : 'Toàn sàn'}</p>
                  <p>Giới hạn: {coupon.usageLimit} lượt</p>
                  <p>Hết hạn: {coupon.expiryDate ? new Date(coupon.expiryDate).toLocaleDateString('vi-VN') : 'Không'}</p>
                </div>
                <button onClick={() => handleDelete(coupon.id)} className="btn-delete">Xóa</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}