import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { productsAPI } from '../api/app';
import '../styles/AdminProducts.css';
import '../styles/ProductSearch.css';
import ProductSearch from '../components/ProductSearch';
import ProductFilters from '../components/ProductFilters';
import ProductTable from '../components/ProductTable';
import Pagination from '../components/Pagination';
import LoadingSkeleton from '../components/LoadingSkeleton';

const INITIAL_FORM_STATE = {
  name: '',
  description: '',
  sku: '',
  brandId: '',
  brand: '',
  categoryId: '',
  material: '',
  careInstructions: '',
  mainImageUrl: '',
  isFeatured: false,
  isAvailable: true,
  imageUrls: [],
  variants: []
};

const INITIAL_VARIANT = {
  id: null,
  colorId: '',
  color: '',
  hexCode: '',
  sizeId: '',
  size: '',
  price: 0,
  stock: 0,
  sku: '',
  isAvailable: true,
  imageUrls: []
};

export default function AdminProducts() {
  const navigate = useNavigate();
  const { id: productId } = useParams();
  const { pathname } = useLocation();
  const { token, isAdmin } = useAuth();
  const { addNotification } = useNotification();

  // FIX: Store notification message in ref to avoid infinite loop
  const notificationRef = useRef(null);

  // FIX: Use pathname to distinguish modes reliably
  const isListView = !pathname.includes('/new') && !pathname.includes('/edit');
  const isAdding = pathname.includes('/new');
  const isEditing = pathname.includes('/edit');

  // ==================== LIST VIEW STATES ====================
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [colors, setColors] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('name');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // ==================== FORM/EDIT STATES ====================
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [formLoading, setFormLoading] = useState(() => isEditing);  // FIX: Initialize based on mode
  const [formErrors, setFormErrors] = useState({});
  const [editingVariantIndex, setEditingVariantIndex] = useState(null);
  const [currentVariant, setCurrentVariant] = useState(INITIAL_VARIANT);

  // ==================== LIST VIEW EFFECTS & FUNCTIONS ====================

  const getProductStatus = (product) => {
    const totalStock = product.productVariants?.reduce((sum, v) => sum + (v.stock || 0), 0) || 0;
    if (product.isDiscontinued) return 'discontinued';
    if (totalStock === 0) return 'outOfStock';
    if (totalStock <= 10) return 'lowStock';
    return 'available';
  };

  const fetchListData = useCallback(async () => {
    try {
      setLoading(true);
      const [productsData, categoriesData, brandsData, sizesData, colorsData] = await Promise.all([
        productsAPI.getProducts(),
        productsAPI.getCategories(),
        productsAPI.getBrands(),
        productsAPI.getSizes(),
        productsAPI.getColors()
      ]);

      setProducts(productsData);
      setCategories(categoriesData || []);
      setBrands(brandsData || []);
      setSizes(sizesData || []);
      setColors(colorsData || []);
    } catch (error) {
      console.error('Error fetching list data:', error);
      addNotification('Lỗi tải dữ liệu sản phẩm', 'error');
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  // Initialize - fetch list data only when in list view
  useEffect(() => {
    if (!isAdmin()) {
      navigate('/');
      return;
    }

    if (isListView) {
      fetchListData();
    }
  }, [isListView, isAdmin, navigate, fetchListData]);

  // Filter & Search Logic
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (searchType === 'name') {
          if (!product.name?.toLowerCase().includes(query)) return false;
        } else if (searchType === 'sku') {
          if (!product.sku?.toLowerCase().includes(query)) return false;
        }
      }

      if (selectedCategory !== 'all' && product.categoryId?.toString() !== selectedCategory) {
        return false;
      }

      if (selectedBrand !== 'all' && product.brand !== selectedBrand) {
        return false;
      }

      if (selectedStatus !== 'all') {
        if (getProductStatus(product) !== selectedStatus) {
          return false;
        }
      }

      if (stockFilter !== 'all') {
        const totalStock = product.productVariants?.reduce((sum, v) => sum + (v.stock || 0), 0) || 0;
        if (stockFilter === 'lowStock' && totalStock > 10) return false;
        if (stockFilter === 'outOfStock' && totalStock > 0) return false;
      }

      return true;
    });
  }, [products, searchQuery, searchType, selectedCategory, selectedBrand, selectedStatus, stockFilter]);

  // Pagination
  const totalItems = filteredProducts.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, selectedBrand, selectedStatus, stockFilter]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedBrand('all');
    setSelectedStatus('all');
    setStockFilter('all');
    setCurrentPage(1);
  };

  const hasActiveFilters = 
    searchQuery || 
    selectedCategory !== 'all' || 
    selectedBrand !== 'all' || 
    selectedStatus !== 'all' || 
    stockFilter !== 'all';

  const handleAddProduct = () => {
    navigate('/admin/products/new');
  };

  const handleEditProduct = (productId) => {
    navigate(`/admin/products/${productId}/edit`);
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa sản phẩm này?')) return;
    
    try {
      await productsAPI.deleteProduct(productId, token);
      addNotification('Xóa sản phẩm thành công', 'success');
      fetchListData();
    } catch (error) {
      console.error('Error deleting product:', error);
      addNotification('Lỗi xóa sản phẩm', 'error');
    }
  };

  const handleViewProduct = (productId) => {
    navigate(`/products/${productId}`);
  };

  // ==================== FORM/EDIT VIEW FUNCTIONS ====================

  // FIX #1: Load product data for edit mode
  useEffect(() => {
    if (isEditing && productId) {
      const loadProduct = async () => {
        try {
          setFormLoading(true);
          const product = await productsAPI.getProduct(productId);
          
          // FIX: Map variant data correctly - API uses camelCase property names
          const mappedVariants = (product.productVariants || []).map((v, idx) => ({
            id: v.id ?? null,
            uniqueKey: v.id ? `variant-${v.id}` : `variant-${idx}-${Date.now()}`,
            colorId: v.colorId ?? '',  // FIX: Use nullish coalescing to preserve 0
            color: v.color ?? '',
            hexCode: v.hexCode ?? '',
            sizeId: v.sizeId ?? '',  // FIX: Use nullish coalescing to preserve 0
            size: v.size ?? '',
            price: v.price ?? 0,
            stock: v.stock ?? 0,
            sku: v.sku ?? '',
            isAvailable: v.isAvailable !== undefined ? v.isAvailable : true,
            imageUrls: [] // Variants don't have separate images in current schema
          }));
          
          setFormData({
            name: product.name || '',
            description: product.description || '',
            sku: product.sku || '',
            brandId: product.brandId || '',
            brand: product.brand || '',
            categoryId: product.categoryId || '',
            material: product.material || '',
            careInstructions: product.careInstructions || '',
            mainImageUrl: product.mainImageUrl || '',
            isFeatured: product.isFeatured || false,
            isAvailable: product.isAvailable !== undefined ? product.isAvailable : true,
            imageUrls: product.images?.map(img => img.url) || [],
            variants: mappedVariants
          });
          
          // Store notification message instead of calling directly (FIX: Avoid infinite loop)
          notificationRef.current = { msg: 'Tải dữ liệu sản phẩm thành công', type: 'success' };
        } catch (error) {
          console.error('Error loading product:', error);
          notificationRef.current = { msg: 'Lỗi tải dữ liệu sản phẩm', type: 'error' };
          navigate('/admin/products');
        } finally {
          setFormLoading(false);
        }
      };
      loadProduct();
    }
  }, [isEditing, productId, navigate]);

  // FIX #1 Part 2: Show notification after form loads (prevents infinite loop)
  useEffect(() => {
    if (notificationRef.current && !formLoading) {
      const { msg, type } = notificationRef.current;
      addNotification(msg, type);
      notificationRef.current = null;
    }
  }, [formLoading, addNotification]);

  // Form field change handlers
  const handleFormFieldChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    if (formErrors[field]) {
      setFormErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  // Variant handlers
  const handleAddVariant = () => {
    setEditingVariantIndex(-1);  // FIX: Use -1 to indicate "adding new variant"
    setCurrentVariant(INITIAL_VARIANT);
  };

  const handleEditVariant = (index) => {
    setEditingVariantIndex(index);
    setCurrentVariant({...formData.variants[index]});
  };

  const handleSaveVariant = () => {
    // Validate variant
    const errors = {};
    if (!currentVariant.color && !currentVariant.colorId) errors.color = 'Màu sắc là bắt buộc';
    if (!currentVariant.size && !currentVariant.sizeId) errors.size = 'Kích cỡ là bắt buộc';
    if (currentVariant.price <= 0) errors.price = 'Giá phải lớn hơn 0';
    if (currentVariant.stock < 0) errors.stock = 'Tồn kho không thể âm';

    if (Object.keys(errors).length > 0) {
      addNotification('Vui lòng điền đầy đủ thông tin biến thể', 'error');
      return;
    }

    // FIX: Handle adding new variant (editingVariantIndex === -1) vs editing existing
    if (editingVariantIndex === -1) {
      // Adding new variant with a stable unique key
      const newVariant = {
        ...currentVariant,
        uniqueKey: `variant-new-${Date.now()}`
      };

      setFormData(prev => ({
        ...prev,
        variants: [...prev.variants, newVariant]
      }));
    } else if (editingVariantIndex !== null && editingVariantIndex >= 0) {
      // Editing existing variant
      const updatedVariants = [...formData.variants];
      updatedVariants[editingVariantIndex] = currentVariant;
      setFormData(prev => ({...prev, variants: updatedVariants}));
    }

    setEditingVariantIndex(null);
    setCurrentVariant(INITIAL_VARIANT);
    addNotification('Lưu biến thể thành công', 'success');
  };

  const handleDeleteVariant = (index) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index)
    }));
    addNotification('Xóa biến thể thành công', 'success');
  };

  // Form validation
  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim()) errors.name = 'Tên sản phẩm là bắt buộc';
    if (!formData.description.trim()) errors.description = 'Mô tả là bắt buộc';
    if (formData.categoryId === '' || formData.categoryId === null || formData.categoryId === undefined) errors.categoryId = 'Danh mục là bắt buộc';
    if (formData.variants.length === 0) errors.variants = 'Sản phẩm phải có ít nhất một biến thể';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Form submission
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      addNotification('Vui lòng điền đầy đủ thông tin bắt buộc', 'error');
      return;
    }

    try {
      setFormLoading(true);

      const payload = {
        id: isEditing ? parseInt(productId) : undefined,
        name: formData.name.trim(),
        description: formData.description.trim(),
        sku: formData.sku.trim() || '',
        brandId: (formData.brandId || formData.brandId === 0) && formData.brandId !== '' ? parseInt(formData.brandId) : null,
        brand: formData.brand.trim() || '',
        categoryId: (formData.categoryId || formData.categoryId === 0) && formData.categoryId !== '' ? parseInt(formData.categoryId) : null,
        material: formData.material.trim() || '',
        careInstructions: formData.careInstructions.trim() || '',
        mainImageUrl: formData.mainImageUrl.trim() || '',
        isFeatured: formData.isFeatured,
        isAvailable: formData.isAvailable,
        imageUrls: formData.imageUrls.filter(url => url.trim()),
        variants: formData.variants.map(v => {
          // FIX: Properly handle variant data to avoid losing IDs or breaking on type errors
          const variantPayload = {
            id: (v.id || v.id === 0) ? v.id : undefined,
            colorId: (v.colorId || v.colorId === 0) && v.colorId !== '' && !isNaN(parseInt(v.colorId)) ? parseInt(v.colorId) : undefined,
            color: v.color && typeof v.color === 'string' ? v.color.trim() || undefined : v.color,
            hexCode: v.hexCode && typeof v.hexCode === 'string' ? v.hexCode.trim() : '',
            sizeId: (v.sizeId || v.sizeId === 0) && v.sizeId !== '' && !isNaN(parseInt(v.sizeId)) ? parseInt(v.sizeId) : undefined,
            size: v.size && typeof v.size === 'string' ? v.size.trim() || undefined : v.size,
            price: typeof v.price === 'number' ? v.price : parseFloat(v.price) || 0,
            stock: typeof v.stock === 'number' ? v.stock : parseInt(v.stock) || 0,
            sku: v.sku && typeof v.sku === 'string' ? v.sku.trim() : '',
            isAvailable: v.isAvailable,
            imageUrls: v.imageUrls ? v.imageUrls.filter(url => url && typeof url === 'string' && url.trim()) : []
          };
          return variantPayload;
        })
      };

      if (isAdding) {
        await productsAPI.createProduct(payload, token);
        addNotification('Tạo sản phẩm thành công', 'success');
      } else if (isEditing) {
        await productsAPI.updateProduct(productId, payload, token);
        addNotification('Cập nhật sản phẩm thành công', 'success');
      }

      navigate('/admin/products');
    } catch (error) {
      console.error('Error submitting form:', error);
      
      // Check specifically for the JSON parsing error
      const isJsonError = error instanceof SyntaxError && error.message.includes('JSON');
      const errorMessage = isJsonError 
        ? 'Yêu cầu thành công nhưng máy chủ phản hồi rỗng (JSON error). Vui lòng kiểm tra lại danh sách.' 
        : (error.message || 'Lỗi lưu sản phẩm');
        
      addNotification(errorMessage, 'error');
    } finally {
      setFormLoading(false);
    }
  };

  // Loading state
  if (loading) {
    return <LoadingSkeleton type="content" />;
  }

  // ==================== RENDER ====================

  if (isListView) {
    return (
      <div className="admin-products-page">
        {/* HEADER */}
        <div className="products-header">
          <div className="header-left">
            <h1>Sản Phẩm</h1>
            <span className="product-count">({totalItems})</span>
          </div>
          <button className="btn-primary" onClick={handleAddProduct}>
            + Thêm sản phẩm
          </button>
        </div>

        {/* TOOLBAR - SEARCH & FILTERS */}
        <div className="products-toolbar">
          <ProductSearch
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchType={searchType}
            setSearchType={setSearchType}
          />
          <ProductFilters
            categories={categories}
            brands={brands}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            selectedBrand={selectedBrand}
            setSelectedBrand={setSelectedBrand}
            selectedStatus={selectedStatus}
            setSelectedStatus={setSelectedStatus}
            stockFilter={stockFilter}
            setStockFilter={setStockFilter}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={handleClearFilters}
          />
        </div>

        {/* PRODUCTS TABLE */}
        {paginatedProducts.length > 0 ? (
          <ProductTable
            products={paginatedProducts}
            getProductStatus={getProductStatus}
            onEdit={handleEditProduct}
            onDelete={handleDeleteProduct}
            onView={handleViewProduct}
          />
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📦</div>
            <h3>Không tìm thấy sản phẩm</h3>
            <p>Hãy điều chỉnh tiêu chí tìm kiếm hoặc thêm sản phẩm mới</p>
          </div>
        )}

        {/* PAGINATION */}
        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            itemsPerPage={itemsPerPage}
            setItemsPerPage={setItemsPerPage}
            setCurrentPage={setCurrentPage}
            totalItems={totalItems}
          />
        )}
      </div>
    );
  }

  // FORM VIEW (ADD/EDIT)
  return (
    <div className="admin-products-page">
      <div className="product-form-container">
        <div className="form-header">
          <h2>{isEditing ? `Chỉnh sửa sản phẩm #${productId}` : 'Thêm sản phẩm mới'}</h2>
          <button className="btn-secondary" onClick={() => navigate('/admin/products')}>
            ← Quay lại danh sách
          </button>
        </div>

        {formLoading ? (
          <LoadingSkeleton type="content" />
        ) : (
          <form className="admin-form" onSubmit={handleSubmitForm}>
            {/* BASIC INFORMATION */}
            <div className="form-section">
              <h3>Thông Tin Cơ Bản</h3>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Tên sản phẩm *</label>
                  <input
                    type="text"
                    placeholder="Nhập tên sản phẩm..."
                    value={formData.name}
                    onChange={(e) => handleFormFieldChange('name', e.target.value)}
                    className={formErrors.name ? 'error' : ''}
                  />
                  {formErrors.name && <span className="error-text">{formErrors.name}</span>}
                </div>
                <div className="form-group">
                  <label>SKU</label>
                  <input
                    type="text"
                    placeholder="Mã sản phẩm..."
                    value={formData.sku}
                    onChange={(e) => handleFormFieldChange('sku', e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Mô tả sản phẩm *</label>
                <textarea
                  placeholder="Nhập mô tả chi tiết sản phẩm..."
                  value={formData.description}
                  onChange={(e) => handleFormFieldChange('description', e.target.value)}
                  className={formErrors.description ? 'error' : ''}
                  rows="4"
                />
                {formErrors.description && <span className="error-text">{formErrors.description}</span>}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Danh mục *</label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => handleFormFieldChange('categoryId', e.target.value)}
                    className={formErrors.categoryId ? 'error' : ''}
                  >
                    <option value="">-- Chọn danh mục --</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                  {formErrors.categoryId && <span className="error-text">{formErrors.categoryId}</span>}
                </div>
                <div className="form-group">
                  <label>Thương hiệu</label>
                  <input
                    type="text"
                    placeholder="Tên thương hiệu..."
                    value={formData.brand}
                    onChange={(e) => handleFormFieldChange('brand', e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Chất liệu</label>
                  <input
                    type="text"
                    placeholder="Chất liệu sản phẩm..."
                    value={formData.material}
                    onChange={(e) => handleFormFieldChange('material', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Hướng dẫn bảo quản</label>
                  <input
                    type="text"
                    placeholder="Cách bảo quản..."
                    value={formData.careInstructions}
                    onChange={(e) => handleFormFieldChange('careInstructions', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* IMAGES */}
            <div className="form-section">
              <h3>Hình Ảnh</h3>
              
              <div className="form-group">
                <label>URL Ảnh Chính</label>
                <input
                  type="url"
                  placeholder="https://example.com/main-image.jpg"
                  value={formData.mainImageUrl}
                  onChange={(e) => handleFormFieldChange('mainImageUrl', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Các URL Ảnh Khác (Một URL mỗi dòng)</label>
                <textarea
                  placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg"
                  value={formData.imageUrls.join('\n')}
                  onChange={(e) => handleFormFieldChange('imageUrls', e.target.value.split('\n'))}
                  rows="4"
                />
              </div>
            </div>

            {/* SETTINGS */}
            <div className="form-section">
              <h3>Cài Đặt</h3>
              
              <div className="form-row checkbox-row">
                <div className="form-group checkbox">
                  <input
                    type="checkbox"
                    id="isFeatured"
                    checked={formData.isFeatured}
                    onChange={(e) => handleFormFieldChange('isFeatured', e.target.checked)}
                  />
                  <label htmlFor="isFeatured">Sản phẩm nổi bật</label>
                </div>
                <div className="form-group checkbox">
                  <input
                    type="checkbox"
                    id="isAvailable"
                    checked={formData.isAvailable}
                    onChange={(e) => handleFormFieldChange('isAvailable', e.target.checked)}
                  />
                  <label htmlFor="isAvailable">Còn hàng</label>
                </div>
              </div>
            </div>

            {/* VARIANTS */}
            <div className="form-section">
              <div className="section-header">
                <h3>Biến Thể Sản Phẩm *</h3>
                {editingVariantIndex === null && (
                  <button
                    type="button"
                    className="btn-secondary small"
                    onClick={handleAddVariant}
                  >
                    + Thêm biến thể
                  </button>
                )}
              </div>

              {formErrors.variants && (
                <div className="error-alert">{formErrors.variants}</div>
              )}

              {/* Variant Editor */}
              {editingVariantIndex !== null ? (
                <div className="variant-editor">
                  <h4>{editingVariantIndex === -1 ? 'Thêm biến thể mới' : 'Chỉnh sửa biến thể'}</h4>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label>Màu sắc *</label>
                      <input
                        type="text"
                        placeholder="Tên màu..."
                        value={currentVariant.color}
                        onChange={(e) => setCurrentVariant({...currentVariant, color: e.target.value})}
                      />
                    </div>
                    <div className="form-group">
                      <label>Mã Hex</label>
                      <input
                        type="text"
                        placeholder="#000000"
                        value={currentVariant.hexCode}
                        onChange={(e) => setCurrentVariant({...currentVariant, hexCode: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Kích cỡ *</label>
                      <input
                        type="text"
                        placeholder="Kích cỡ..."
                        value={currentVariant.size}
                        onChange={(e) => setCurrentVariant({...currentVariant, size: e.target.value})}
                      />
                    </div>
                    <div className="form-group">
                      <label>Giá *</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={currentVariant.price}
                        onChange={(e) => setCurrentVariant({...currentVariant, price: parseFloat(e.target.value) || 0})}
                        step="0.01"
                        min="0"
                      />
                    </div>
                    <div className="form-group">
                      <label>Tồn kho *</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={currentVariant.stock}
                        onChange={(e) => setCurrentVariant({...currentVariant, stock: parseInt(e.target.value) || 0})}
                        min="0"
                      />
                    </div>
                  </div>

                  <div className="form-actions variant-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        setEditingVariantIndex(null);
                        setCurrentVariant(INITIAL_VARIANT);
                      }}
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={handleSaveVariant}
                    >
                      Lưu biến thể
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Variant List */}
              {formData.variants.length > 0 && (
                <div className="variants-list">
                  <table className="variants-table">
                    <thead>
                      <tr>
                        <th>Màu</th>
                        <th>Kích cỡ</th>
                        <th>Giá</th>
                        <th>Tồn kho</th>
                        <th>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.variants.map((variant, idx) => (
                        <tr key={variant.uniqueKey || `${variant.color}-${variant.size}-${idx}`}>
                          <td>{variant.color}</td>
                          <td>{variant.size}</td>
                          <td>{variant.price.toLocaleString('vi-VN')}đ</td>
                          <td>{variant.stock}</td>
                          <td>
                            <div className="variant-actions">
                              <button
                                type="button"
                                className="btn-icon btn-edit"
                                onClick={() => handleEditVariant(idx)}
                                title="Sửa"
                              >
                                ✏️
                              </button>
                              <button
                                type="button"
                                className="btn-icon btn-delete"
                                onClick={() => handleDeleteVariant(idx)}
                                title="Xóa"
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* FORM ACTIONS */}
            <div className="form-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => navigate('/admin/products')}
                disabled={formLoading}
              >
                Hủy
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={formLoading}
              >
                {formLoading ? 'Đang lưu...' : (isEditing ? 'Cập nhật sản phẩm' : 'Tạo sản phẩm')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
