import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useNotification } from '../context/NotificationContext';
import '../styles/Products.css';

export default function Products() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addNotification } = useNotification();

  // ✅ FIX: Dùng ref để dùng addNotification trong useCallback mà không cần đưa vào deps
  // Trước đây: addNotification trong deps → fetchProducts thay đổi mỗi render → fetch liên tục
  const addNotificationRef = useRef(addNotification);
  useEffect(() => {
    addNotificationRef.current = addNotification;
  }, [addNotification]);

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
  const [currentPage, setCurrentPage] = useState(1);
  const productsPerPage = 8;

  // ✅ FIX: fetchCategories không có deps → chỉ tạo 1 lần, không bao giờ thay đổi
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
  }, []); // ✅ không deps → stable, chỉ fetch 1 lần

  // ✅ FIX: bỏ addNotification khỏi deps, dùng addNotificationRef thay thế
  const fetchProducts = useCallback(async () => {
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

        if (sortBy === 'price-low') {
          data.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
        } else if (sortBy === 'price-high') {
          data.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
        } else if (sortBy === 'rating') {
          data.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
        }

        setProducts(data);
        setCurrentPage(1);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
      addNotificationRef.current('Lỗi khi tải sản phẩm', 'error'); // ✅ dùng ref
    } finally {
      setLoading(false);
    }
  }, [filters, sortBy]); // ✅ chỉ giữ filters và sortBy — đúng deps thực sự cần

  // ✅ FIX: tách 2 useEffect riêng biệt
  // fetchCategories chỉ chạy 1 lần lúc mount
  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // fetchProducts chạy lại khi filters hoặc sortBy thay đổi
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleProductClick = (productId) => {
    navigate(`/products/${productId}`);
  };

  const indexOfLastProduct = currentPage * productsPerPage;
  const indexOfFirstProduct = indexOfLastProduct - productsPerPage;
  const currentProducts = products.slice(indexOfFirstProduct, indexOfLastProduct);
  const totalPages = Math.ceil(products.length / productsPerPage);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
              aria-label="Lọc theo danh mục sản phẩm"
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
                aria-label="Giá tối thiểu"
              />
              <span>-</span>
              <input
                type="number"
                placeholder="Đến"
                value={filters.maxPrice}
                onChange={(e) => handleFilterChange('maxPrice', e.target.value)}
                className="filter-input"
                aria-label="Giá tối đa"
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
                aria-label="Sắp xếp sản phẩm theo tiêu chí"
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
            <>
              <div className="products-grid">
                {currentProducts.map((product) => (
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
                        <span className="stars">⭐ {Number(product.rating ?? 0).toFixed(1)}</span>
                        <span className="reviews">({product.reviewCount ?? 0})</span>
                      </div>
                      <div className="product-price">
                        {product.price !== undefined && product.price !== null
                          ? product.price.toLocaleString('vi-VN')
                          : product.productVariants?.[0]?.price
                          ? product.productVariants[0].price.toLocaleString('vi-VN')
                          : '0'}{' '}
                        VNĐ
                      </div>
                      <button
                        onClick={() => handleProductClick(product.id)}
                        className="btn-add-to-cart"
                      >
                        Xem chi tiết
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="bob-pagination">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="pagination-arrow"
                  >
                    PREV
                  </button>

                  {Array.from({ length: totalPages }, (_, index) => (
                    <button
                      key={index + 1}
                      onClick={() => handlePageChange(index + 1)}
                      className={`pagination-number ${currentPage === index + 1 ? 'active' : ''}`}
                    >
                      {index + 1}
                    </button>
                  ))}

                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="pagination-arrow"
                  >
                    NEXT
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}