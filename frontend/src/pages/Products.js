import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useNotification } from '../context/NotificationContext';
import '../styles/Products.css';

export default function Products() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addToCart } = useCart();
  const { addNotification } = useNotification();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    query: searchParams.get('query') || '',
    categoryId: searchParams.get('categoryId') || '',
    color: searchParams.get('color') || '',
    minPrice: searchParams.get('minPrice') || '',
    maxPrice: searchParams.get('maxPrice') || '',
  });
  const [sortBy, setSortBy] = useState('newest');

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/products/categories`);
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.query) params.append('query', filters.query);
      if (filters.categoryId) params.append('categoryId', filters.categoryId);
      if (filters.color) params.append('color', filters.color);
      if (filters.minPrice) params.append('minPrice', filters.minPrice);
      if (filters.maxPrice) params.append('maxPrice', filters.maxPrice);

      const response = await fetch(`${process.env.REACT_APP_API_URL}/products/search?${params}`);
      if (response.ok) {
        let data = await response.json();
        
        // Sort products
        if (sortBy === 'price-low') {
          data.sort((a, b) => a.price - b.price);
        } else if (sortBy === 'price-high') {
          data.sort((a, b) => b.price - a.price);
        } else if (sortBy === 'rating') {
          data.sort((a, b) => b.rating - a.rating);
        }
        
        setProducts(data);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
      addNotification('Lỗi khi tải sản phẩm', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchProducts();
  }, [filters]);

  const handleFilterChange = (field, value) => {
    setFilters({ ...filters, [field]: value });
  };

  const handleAddToCart = (product) => {
    addToCart(product);
    addNotification(`${product.name} đã được thêm vào giỏ hàng!`, 'success');
  };

  const handleProductClick = (productId) => {
    navigate(`/products/${productId}`);
  };

  return (
    <div className="products-page">
      <div className="products-header">
        <h1>Sản Phẩm</h1>
        <p>Khám phá bộ sưu tập áo quần chất lượng cao</p>
      </div>

      <div className="products-container">
        {/* Sidebar - Filters */}
        <aside className="products-sidebar">
          <div className="filter-section">
            <h3>Tìm Kiếm</h3>
            <input
              type="text"
              placeholder="Tên sản phẩm..."
              value={filters.query}
              onChange={(e) => handleFilterChange('query', e.target.value)}
              className="filter-input"
            />
          </div>

          <div className="filter-section">
            <h3>Danh Mục</h3>
            <select
              value={filters.categoryId}
              onChange={(e) => handleFilterChange('categoryId', e.target.value)}
              className="filter-select"
            >
              <option value="">Tất cả danh mục</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-section">
            <h3>Màu Sắc</h3>
            <input
              type="text"
              placeholder="Ví dụ: Đỏ, Xanh..."
              value={filters.color}
              onChange={(e) => handleFilterChange('color', e.target.value)}
              className="filter-input"
            />
          </div>

          <div className="filter-section">
            <h3>Giá</h3>
            <div className="price-range">
              <input
                type="number"
                placeholder="Từ"
                value={filters.minPrice}
                onChange={(e) => handleFilterChange('minPrice', e.target.value)}
                className="filter-input"
              />
              <span>-</span>
              <input
                type="number"
                placeholder="Đến"
                value={filters.maxPrice}
                onChange={(e) => handleFilterChange('maxPrice', e.target.value)}
                className="filter-input"
              />
            </div>
          </div>

          <button
            onClick={() => setFilters({ query: '', categoryId: '', color: '', minPrice: '', maxPrice: '' })}
            className="btn-clear-filters"
          >
            Xóa Bộ Lọc
          </button>
        </aside>

        {/* Main Content */}
        <main className="products-main">
          <div className="products-top">
            <div className="product-count">
              {loading ? 'Đang tải...' : `${products.length} sản phẩm`}
            </div>
            <div className="sort-select">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="newest">Mới nhất</option>
                <option value="price-low">Giá: Thấp → Cao</option>
                <option value="price-high">Giá: Cao → Thấp</option>
                <option value="rating">Đánh giá cao nhất</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="loading">Đang tải sản phẩm...</div>
          ) : products.length === 0 ? (
            <div className="no-products">Không tìm thấy sản phẩm nào.</div>
          ) : (
            <div className="products-grid">
              {products.map((product) => (
                <div key={product.id} className="product-card">
                  <div
                    className="product-image-container"
                    onClick={() => handleProductClick(product.id)}
                  >
                    <img
                      src={product.mainImageUrl || '/placeholder.jpg'}
                      alt={product.name}
                      className="product-image"
                    />
                    {product.isFeatured && <span className="badge-featured">Nổi Bật</span>}
                  </div>
                  <div className="product-info">
                    <h3 className="product-name" onClick={() => handleProductClick(product.id)}>
                      {product.name}
                    </h3>
                    <div className="product-rating">
                      <span className="stars">⭐ {product.rating.toFixed(1)}</span>
                      <span className="reviews">({product.reviewCount})</span>
                    </div>
                    <div className="product-price">
                      {product.price.toLocaleString('vi-VN')} VNĐ
                    </div>
                    <button
                      onClick={() => handleAddToCart(product)}
                      className="btn-add-to-cart"
                    >
                      Thêm vào giỏ
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
