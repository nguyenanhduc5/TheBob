import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useNotification } from '../context/NotificationContext';
import '../styles/Products.css';

export default function Products() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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

  // Thêm State quản lý phân trang
  const [currentPage, setCurrentPage] = useState(1);
  const productsPerPage = 8; // Hiển thị 8 sản phẩm/trang (vừa khít 2 hàng x 4 cột)

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
        
        // Sắp xếp sản phẩm an toàn bằng cách kiểm tra sự tồn tại của thuộc tính price
        if (sortBy === 'price-low') {
          data.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
        } else if (sortBy === 'price-high') {
          data.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
        } else if (sortBy === 'rating') {
          data.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
        }
        
        setProducts(data);
        setCurrentPage(1); // Reset về trang 1 mỗi khi đổi bộ lọc hoặc sắp xếp
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
      addNotification('Lỗi khi tải sản phẩm', 'error');
    } finally {
      setLoading(false);
    }
  }, [filters, sortBy, addNotification]);

  useEffect(() => {
    fetchCategories();
    fetchProducts();
  }, [fetchCategories, fetchProducts]);

  const handleFilterChange = (field, value) => {
    setFilters({ ...filters, [field]: value });
  };

  const handleProductClick = (productId) => {
    navigate(`/products/${productId}`);
  };

  // Tính toán logic chia dữ liệu cho trang hiện tại
  const indexOfLastProduct = currentPage * productsPerPage;
  const indexOfFirstProduct = indexOfLastProduct - productsPerPage;
  const currentProducts = products.slice(indexOfFirstProduct, indexOfLastProduct);
  const totalPages = Math.ceil(products.length / productsPerPage);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    // Cuộn mượt lên vị trí lưới sản phẩm để người dùng tiện theo dõi loạt hàng mới
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
              {/* Chỉ map mảng currentProducts đã qua xử lý phân trang */}
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

              {/* Khối giao diện phân trang hiển thị khi tổng số trang lớn hơn 1 */}
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