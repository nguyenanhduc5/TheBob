import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import '../styles/AdminProducts.css';
import AdminLayout from '../components/AdminLayout';

export default function AdminProducts() {
  const navigate = useNavigate();
  const { token, isAdmin } = useAuth();
  const { addNotification } = useNotification();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Khởi tạo danh sách biến thể động (theo sơ đồ ProductVariants)
  const [variants, setVariants] = useState([
    { size: 'S', color: 'Đen', stock: '', sku: '' }
  ]);

  const defaultFormData = {
    name: '',
    sku: '',
    description: '',
    brand: '',
    material: '',
    careInstructions: '',
    mainImageUrl: '',
    isFeatured: false,
    categoryId: '',
    rating: '0',
    reviewCount: '0',
    price: '',
    imageUrls: [],
  };

  const [formData, setFormData] = useState(defaultFormData);

  const fetchProducts = useCallback(async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/products`);
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
      }
    } catch (error) {
      console.error(error);
      addNotification('Lỗi tải dữ liệu sản phẩm', 'error');
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/products/categories`);
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin()) { navigate('/'); return; }
    fetchProducts();
    fetchCategories();
  }, [fetchProducts, fetchCategories, isAdmin, navigate]);

  const handleFormChange = (field) => (e) => {
    const value = field === 'isFeatured' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [field]: value });
  };

  // --- HÀM THAO TÁC MẢNG BIẾN THỂ (VARIANTS) ---
  const handleAddVariant = () => {
    setVariants([...variants, { size: '', color: '', stock: '', sku: '' }]);
  };

  const handleVariantChange = (index, field, value) => {
    const newVariants = [...variants];
    newVariants[index][field] = value;
    setVariants(newVariants);
  };

  const handleRemoveVariant = (index) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  const handleImageUrlAdd = () => {
    setFormData({ ...formData, imageUrls: [...formData.imageUrls, ''] });
  };

  const handleImageUrlChange = (index, value) => {
    const newImageUrls = [...formData.imageUrls];
    newImageUrls[index] = value;
    setFormData({ ...formData, imageUrls: newImageUrls });
  };

  const handleImageUrlRemove = (index) => {
    setFormData({ ...formData, imageUrls: formData.imageUrls.filter((_, i) => i !== index) });
  };

  const resetForm = () => {
    setFormData(defaultFormData);
    setVariants([{ size: 'S', color: 'Đen', stock: '', sku: '' }]);
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Xác thực sơ bộ mảng biến thể
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      if (!v.size || !v.color || v.stock === '') {
        addNotification(`Vui lòng nhập đầy đủ Size, Màu và Kho tại dòng biến thể thứ ${i + 1}`, 'warning');
        return;
      }
      if (parseInt(v.stock, 10) < 0) {
        addNotification('Số lượng tồn kho không được âm', 'warning');
        return;
      }
    }

    // Xác thực giá sản phẩm chính
    if (!formData.price || Number(formData.price) < 0) {
      addNotification('Vui lòng nhập giá sản phẩm hợp lệ', 'warning');
      return;
    }

    const payload = {
      ...formData,
      categoryId: formData.categoryId ? parseInt(formData.categoryId, 10) : null,
      rating: Number(formData.rating) || 0,
      reviewCount: parseInt(formData.reviewCount, 10) || 0,
      price: Number(formData.price) || 0,
      imageUrls: formData.imageUrls.filter(url => url.trim()),
      variants: variants.map(v => ({
        size: v.size,
        color: v.color,
        sku: v.sku.trim() || `${formData.sku}-${v.size}-${v.color}`,
        stock: parseInt(v.stock, 10)
      }))
    };

    try {
      const url = editingId 
        ? `${process.env.REACT_APP_API_URL}/products/${editingId}`
        : `${process.env.REACT_APP_API_URL}/products`;

      const response = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        addNotification(editingId ? 'Cập nhật thành công' : 'Thêm sản phẩm thành công', 'success');
        setShowForm(false);
        resetForm();
        fetchProducts();
      } else {
        addNotification('Lỗi từ hệ thống máy chủ', 'error');
      }
    } catch (error) {
      console.error(error);
      addNotification('Lỗi kết nối mạng', 'error');
    }
  };

  const handleEdit = (product) => {
    setFormData({
      name: product.name || '',
      sku: product.sku || '',
      description: product.description || '',
      brand: product.brand || '',
      material: product.material || '',
      careInstructions: product.careInstructions || '',
      mainImageUrl: product.mainImageUrl || '',
      isFeatured: product.isFeatured || false,
      categoryId: product.categoryId?.toString() || '',
      rating: (product.rating || 0).toString(),
      reviewCount: (product.reviewCount || 0).toString(),
      price: (product.price || 0).toString(),
      imageUrls: product.images?.map(img => img.url) || [],
    });

    if (product.productVariants && product.productVariants.length > 0) {
      setVariants(product.productVariants.map(v => ({
        size: v.size,
        color: v.color,
        stock: v.stock.toString(),
        sku: v.sku || ''
      })));
    } else {
      setVariants([{ size: '', color: '', stock: '', sku: '' }]);
    }

    setEditingId(product.id);
    setShowForm(true);
  };

  const handleDelete = async (productId) => {
    if (!window.confirm('Xác nhận xóa sản phẩm cùng toàn bộ biến thể liên quan?')) return;
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/products/${productId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) { addNotification('Xóa thành công', 'success'); fetchProducts(); }
    } catch (error) { addNotification('Lỗi hệ thống khi xóa', 'error'); }
  };

  if (loading) return <div className="loading-page">Đang xử lý thông tin sản phẩm...</div>;

  return (
    <AdminLayout title="Quản Lý Biến Thể Sản Phẩm">
      <div className="admin-products-page">
        <div className="admin-header">
          <h1>Quản Lý Sản Phẩm (Đa biến thể)</h1>
          <button onClick={() => { if (showForm) { setShowForm(false); resetForm(); } else { setShowForm(true); } }} className="btn-add-product">
            {showForm ? '← Danh Sách' : '+ Thêm Sản Phẩm'}
          </button>
        </div>

        {showForm ? (
          <div className="product-form-section">
            <form onSubmit={handleSubmit} className="product-form">
              <div className="form-section">
                <h2>{editingId ? 'Cập Nhật Sản Phẩm' : 'Tạo Sản Phẩm Mới'}</h2>

                <div className="form-row">
                  <div className="form-group"> <label>Tên Sản Phẩm *</label> <input type="text" value={formData.name} onChange={handleFormChange('name')} required /> </div>
                  <div className="form-group"> <label>Mã Sản Phẩm (SKU chính) *</label> <input type="text" value={formData.sku} onChange={handleFormChange('sku')} required /> </div>
                  <div className="form-group"> <label>Giá Sản Phẩm (đ) *</label> <input type="number" value={formData.price} onChange={handleFormChange('price')} required step="0.01" min="0" /> </div>
                </div>

                {/* KHU VỰC THIẾT LẬP BIẾN THỂ THEO BẢNG PRODUCTVARIANTS */}
                <div className="form-section-sub" style={{ background: '#f4f6f9', padding: '20px', borderRadius: '8px', marginBottom: '25px' }}>
                  <h3 style={{ margin: '0 0 15px 0', color: '#1a202c', fontSize: '16px' }}>Cấu Hình Thuộc Tính Biến Thể (Size, Màu, Kho)</h3>
                  
                  {variants.map((v, index) => (
                    <div key={index} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', background: '#fff', padding: '12px', borderRadius: '6px', marginBottom: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                      <div style={{ width: '80px' }}>
                        <label style={{ fontSize: '11px', display: 'block' }}>Size *</label>
                        <input type="text" value={v.size} onChange={(e) => handleVariantChange(index, 'size', e.target.value)} placeholder="S, M, L..." required style={{ padding: '6px' }} />
                      </div>
                      <div style={{ width: '90px' }}>
                        <label style={{ fontSize: '11px', display: 'block' }}>Màu Sắc *</label>
                        <input type="text" value={v.color} onChange={(e) => handleVariantChange(index, 'color', e.target.value)} placeholder="Đen, Trắng..." required style={{ padding: '6px' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: '80px' }}>
                        <label style={{ fontSize: '11px', display: 'block' }}>Số Kho *</label>
                        <input type="number" value={v.stock} onChange={(e) => handleVariantChange(index, 'stock', e.target.value)} placeholder="Tồn kho" required style={{ padding: '6px' }} />
                      </div>
                      <div style={{ flex: 2, minWidth: '120px' }}>
                        <label style={{ fontSize: '11px', display: 'block' }}>SKU Biến Thể (Tự chọn)</label>
                        <input type="text" value={v.sku} onChange={(e) => handleVariantChange(index, 'sku', e.target.value)} placeholder="Bỏ trống tự sinh" style={{ padding: '6px' }} />
                      </div>
                      {variants.length > 1 && (
                        <button type="button" onClick={() => handleRemoveVariant(index)} style={{ background: '#e53e3e', color: '#fff', border: 'none', borderRadius: '4px', padding: '6px 10px', cursor: 'pointer', marginTop: '15px' }}>✕</button>
                      )}
                    </div>
                  ))}
                  
                  <button type="button" onClick={handleAddVariant} style={{ background: '#3182ce', color: '#fff', border: 'none', borderRadius: '4px', padding: '8px 14px', cursor: 'pointer', fontWeight: '500', fontSize: '13px' }}>
                    + Thêm Dòng Biến Thể Mới
                  </button>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Thương Hiệu</label> <input type="text" value={formData.brand} onChange={handleFormChange('brand')} />
                  </div>
                  <div className="form-group">
                    <label>Danh Mục</label>
                    <select value={formData.categoryId} onChange={handleFormChange('categoryId')}>
                      <option value="">Chọn danh mục</option>
                      {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="form-group full-width"> <label>Mô Tả</label> <textarea value={formData.description} onChange={handleFormChange('description')} rows={3} /> </div>
                <div className="form-row">
                  <div className="form-group"> <label>Chất Liệu</label> <input type="text" value={formData.material} onChange={handleFormChange('material')} /> </div>
                  <div className="form-group"> <label>Bảo Quản</label> <input type="text" value={formData.careInstructions} onChange={handleFormChange('careInstructions')} /> </div>
                </div>

                <div className="form-row">
                  <div className="form-group"> <label>Ảnh Chính</label> <input type="url" value={formData.mainImageUrl} onChange={handleFormChange('mainImageUrl')} /> </div>
                  <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '32px' }}>
                      <input type="checkbox" checked={formData.isFeatured} onChange={handleFormChange('isFeatured')} /> Đặt làm sản phẩm nổi bật
                    </label>
                  </div>
                </div>

                <div className="form-section-sub">
                  <h3>Ảnh Phụ</h3>
                  {formData.imageUrls.map((url, index) => (
                    <div key={index} className="image-url-input">
                      <input type="url" value={url} onChange={(e) => handleImageUrlChange(index, e.target.value)} />
                      <button type="button" onClick={() => handleImageUrlRemove(index)} className="btn-remove-image">✕</button>
                    </div>
                  ))}
                  <button type="button" onClick={handleImageUrlAdd} className="btn-add-image">+ Thêm Ảnh</button>
                </div>
              </div>

              <div className="form-actions">
                <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="btn-cancel">Hủy</button>
                <button type="submit" className="btn-save">Lưu Toàn Bộ</button>
              </div>
            </form>
          </div>
        ) : (
          <div className="products-table-section">
            <div className="products-table">
              <div className="table-header">
                <span className="col-name">Tên Sản Phẩm</span>
                <span className="col-sku">SKU</span>
                <span className="col-category">Danh Mục</span>
                <span className="col-price">Giá (đ)</span>
                <span className="col-variants-detail">Thông tin các Biến thể (Màu - Size - Kho)</span>
                <span className="col-actions">Thao Tác</span>
              </div>

              {products.map((product) => (
                <div key={product.id} className="table-row">
                  <span className="col-name" style={{ fontWeight: '600' }}>{product.name}</span>
                  <span className="col-sku">{product.sku}</span>
                  <span className="col-category">{product.category?.name || '-'}</span>
                  <span className="col-price" style={{ fontWeight: '600', color: '#2d3748' }}>{product.price?.toLocaleString('vi-VN')}đ</span>
                  <span className="col-variants-detail" style={{ fontSize: '12px', color: '#4a5568' }}>
                    {product.productVariants && product.productVariants.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {product.productVariants.map((v, i) => (
                          <div key={i} style={{ background: '#edf2f7', padding: '2px 6px', borderRadius: '4px' }}>
                            🎨 {v.color} | 📐 Size {v.size} | 📦 Tồn: {v.stock}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: '#e53e3e' }}>Chưa thiết lập biến thể</span>
                    )}
                  </span>
                  <span className="col-actions">
                    <button onClick={() => handleEdit(product)} className="btn-edit">Sửa</button>
                    <button onClick={() => handleDelete(product.id)} className="btn-delete">Xóa</button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}