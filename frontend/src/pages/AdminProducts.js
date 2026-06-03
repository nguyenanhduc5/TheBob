import { useState, useEffect, useCallback } from 'react';
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
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    description: '',
    brand: '',
    material: '',
    color: '',
    careInstructions: '',
    price: '',
    stock: '',
    mainImageUrl: '',
    isFeatured: false,
    categoryId: '',
    rating: 0,
    reviewCount: 0,
    imageUrls: [],
    sizes: [],
  });

  const fetchProducts = useCallback(async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/products`);
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
      addNotification('Lỗi khi tải danh sách sản phẩm', 'error');
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
      console.error('Failed to fetch categories:', error);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin()) {
      navigate('/');
      return;
    }
    fetchProducts();
    fetchCategories();
  }, [fetchProducts, fetchCategories, isAdmin, navigate]);

  const handleFormChange = (field) => (e) => {
    const value = field === 'isFeatured' ? e.target.checked : e.target.value;
    setFormData({
      ...formData,
      [field]: value,
    });
  };

  const handleImageUrlAdd = () => {
    setFormData({
      ...formData,
      imageUrls: [...formData.imageUrls, ''],
    });
  };

  const handleImageUrlChange = (index, value) => {
    const newImageUrls = [...formData.imageUrls];
    newImageUrls[index] = value;
    setFormData({
      ...formData,
      imageUrls: newImageUrls,
    });
  };

  const handleImageUrlRemove = (index) => {
    setFormData({
      ...formData,
      imageUrls: formData.imageUrls.filter((_, i) => i !== index),
    });
  };

  const handleSizeAdd = () => {
    if (formData.sizes.length < 5) {
      setFormData({
        ...formData,
        sizes: [...formData.sizes, ''],
      });
    } else {
      addNotification('Tối đa 5 kích thước', 'warning');
    }
  };

  const handleSizeChange = (index, value) => {
    const newSizes = [...formData.sizes];
    newSizes[index] = value;
    setFormData({
      ...formData,
      sizes: newSizes,
    });
  };

  const handleSizeRemove = (index) => {
    setFormData({
      ...formData,
      sizes: formData.sizes.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.price || !formData.stock) {
      addNotification('Vui lòng điền đầy đủ thông tin bắt buộc', 'warning');
      return;
    }

    try {
      const url = editingId
        ? `${process.env.REACT_APP_API_URL}/products/${editingId}`
        : `${process.env.REACT_APP_API_URL}/products`;

      const method = editingId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          price: parseFloat(formData.price),
          stock: parseInt(formData.stock),
          categoryId: formData.categoryId ? parseInt(formData.categoryId) : null,
          rating: parseFloat(formData.rating),
          reviewCount: parseInt(formData.reviewCount),
          imageUrls: formData.imageUrls.filter(url => url.trim()),
          sizes: formData.sizes.filter(size => size.trim()),
        }),
      });

      if (response.ok) {
        addNotification(
          editingId ? 'Cập nhật sản phẩm thành công' : 'Thêm sản phẩm thành công',
          'success'
        );
        setShowForm(false);
        setEditingId(null);
        resetForm();
        fetchProducts();
      } else {
        let message = 'Lỗi khi lưu sản phẩm';
        try {
          const errorData = await response.json();
          message = errorData?.message || message;
        } catch {
          message = `${message} (${response.status})`;
        }
        addNotification(message, 'error');
      }
    } catch (error) {
      console.error('Submit error:', error);
      addNotification('Lỗi khi lưu sản phẩm', 'error');
    }
  };

  const handleEdit = (product) => {
    setFormData({
      name: product.name,
      sku: product.sku,
      description: product.description,
      brand: product.brand,
      material: product.material,
      color: product.color,
      careInstructions: product.careInstructions,
      price: product.price.toString(),
      stock: product.stock.toString(),
      mainImageUrl: product.mainImageUrl,
      isFeatured: product.isFeatured,
      categoryId: product.categoryId?.toString() || '',
      rating: product.rating.toString(),
      reviewCount: product.reviewCount.toString(),
      imageUrls: product.images?.map(img => img.url) || [],
      sizes: product.sizes?.map(size => size.sizeValue) || [],
    });
    setEditingId(product.id);
    setShowForm(true);
  };

  const handleDelete = async (productId) => {
    if (!window.confirm('Bạn chắc chắn muốn xóa sản phẩm này?')) {
      return;
    }

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/products/${productId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        addNotification('Xóa sản phẩm thành công', 'success');
        fetchProducts();
      } else {
        let message = 'Lỗi khi xóa sản phẩm';
        try {
          const errorData = await response.json();
          message = errorData?.message || message;
        } catch {
          message = `${message} (${response.status})`;
        }
        addNotification(message, 'error');
      }
    } catch (error) {
      console.error('Delete error:', error);
      addNotification('Lỗi khi xóa sản phẩm', 'error');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      sku: '',
      description: '',
      brand: '',
      material: '',
      color: '',
      careInstructions: '',
      price: '',
      stock: '',
      mainImageUrl: '',
      isFeatured: false,
      categoryId: '',
      rating: '0',
      reviewCount: '0',
      imageUrls: [],
      sizes: [],
    });
    setEditingId(null);
  };

  if (loading) {
    return <div className="loading-page">Đang tải...</div>;
  }

  return (
    <AdminLayout title="Quản Lý Sản Phẩm">
      <div className="admin-products-page">
      <div className="admin-header">
        <h1>Quản Lý Sản Phẩm</h1>
        <button
          onClick={() => {
            if (showForm) {
              setShowForm(false);
              resetForm();
            } else {
              setShowForm(true);
            }
          }}
          className="btn-add-product"
        >
          {showForm ? '← Quay Lại' : '+ Thêm Sản Phẩm'}
        </button>
      </div>

      {showForm ? (
        <div className="product-form-section">
          <form onSubmit={handleSubmit} className="product-form">
            <div className="form-section">
              <h2>{editingId ? 'Chỉnh Sửa Sản Phẩm' : 'Thêm Sản Phẩm Mới'}</h2>

              <div className="form-row">
                <div className="form-group">
                  <label>Tên Sản Phẩm *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={handleFormChange('name')}
                    placeholder="Tên sản phẩm"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>SKU *</label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={handleFormChange('sku')}
                    placeholder="SKU-001"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Thương Hiệu</label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={handleFormChange('brand')}
                    placeholder="THEBOB"
                  />
                </div>
                <div className="form-group">
                  <label>Danh Mục</label>
                  <select
                    value={formData.categoryId}
                    onChange={handleFormChange('categoryId')}
                  >
                    <option value="">Chọn danh mục</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group full-width">
                <label>Mô Tả</label>
                <textarea
                  value={formData.description}
                  onChange={handleFormChange('description')}
                  placeholder="Mô tả chi tiết sản phẩm"
                  rows={4}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Giá (VNĐ) *</label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={handleFormChange('price')}
                    placeholder="299000"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Tồn Kho *</label>
                  <input
                    type="number"
                    value={formData.stock}
                    onChange={handleFormChange('stock')}
                    placeholder="100"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Màu Sắc</label>
                  <input
                    type="text"
                    value={formData.color}
                    onChange={handleFormChange('color')}
                    placeholder="Đỏ, Xanh, v.v"
                  />
                </div>
                <div className="form-group">
                  <label>Chất Liệu</label>
                  <input
                    type="text"
                    value={formData.material}
                    onChange={handleFormChange('material')}
                    placeholder="Cotton 100%"
                  />
                </div>
              </div>

              <div className="form-group full-width">
                <label>Hướng Dẫn Chăm Sóc</label>
                <input
                  type="text"
                  value={formData.careInstructions}
                  onChange={handleFormChange('careInstructions')}
                  placeholder="Giặt tay, không tẩy"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Ảnh Chính</label>
                  <input
                    type="url"
                    value={formData.mainImageUrl}
                    onChange={handleFormChange('mainImageUrl')}
                    placeholder="https://..."
                  />
                </div>
                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.isFeatured}
                      onChange={handleFormChange('isFeatured')}
                    />
                    Nổi Bật
                  </label>
                </div>
              </div>

              <div className="form-section-sub">
                <h3>Ảnh Phụ</h3>
                {formData.imageUrls.map((url, index) => (
                  <div key={index} className="image-url-input">
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => handleImageUrlChange(index, e.target.value)}
                      placeholder={`https://... (${index + 1})`}
                    />
                    <button
                      type="button"
                      onClick={() => handleImageUrlRemove(index)}
                      className="btn-remove-image"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleImageUrlAdd}
                  className="btn-add-image"
                >
                  + Thêm Ảnh
                </button>
              </div>

              <div className="form-section-sub">
                <h3>Kích Thước (Tối đa 5)</h3>
                {formData.sizes.map((size, index) => (
                  <div key={index} className="size-input">
                    <input
                      type="text"
                      value={size}
                      onChange={(e) => handleSizeChange(index, e.target.value)}
                      placeholder={`Kích thước ${index + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() => handleSizeRemove(index)}
                      className="btn-remove-size"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleSizeAdd}
                  className="btn-add-size"
                >
                  + Thêm Kích Thước
                </button>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Đánh Giá</label>
                  <input
                    type="number"
                    value={formData.rating}
                    onChange={handleFormChange('rating')}
                    placeholder="4.5"
                    min="0"
                    max="5"
                    step="0.1"
                  />
                </div>
                <div className="form-group">
                  <label>Số Bình Luận</label>
                  <input
                    type="number"
                    value={formData.reviewCount}
                    onChange={handleFormChange('reviewCount')}
                    placeholder="0"
                    min="0"
                  />
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="btn-cancel"
              >
                Hủy
              </button>
              <button type="submit" className="btn-save">
                {editingId ? 'Cập Nhật' : 'Thêm'} Sản Phẩm
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="products-table-section">
          {products.length === 0 ? (
            <div className="no-products">Không có sản phẩm nào</div>
          ) : (
            <div className="products-table">
              <div className="table-header">
                <span className="col-name">Tên Sản Phẩm</span>
                <span className="col-sku">SKU</span>
                <span className="col-category">Danh Mục</span>
                <span className="col-price">Giá</span>
                <span className="col-stock">Tồn Kho</span>
                <span className="col-actions">Thao Tác</span>
              </div>

              {products.map((product) => (
                <div key={product.id} className="table-row">
                  <span className="col-name">{product.name}</span>
                  <span className="col-sku">{product.sku}</span>
                  <span className="col-category">
                    {product.category?.name || '-'}
                  </span>
                  <span className="col-price">
                    {product.price.toLocaleString('vi-VN')} VNĐ
                  </span>
                  <span className={`col-stock ${product.stock <= 10 ? 'low' : ''}`}>
                    {product.stock}
                  </span>
                  <span className="col-actions">
                    <button
                      onClick={() => handleEdit(product)}
                      className="btn-edit"
                    >
                      Sửa
                    </button>
                    <button
                      onClick={() => handleDelete(product.id)}
                      className="btn-delete"
                    >
                      Xóa
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      </div>
    </AdminLayout>
  );
}
