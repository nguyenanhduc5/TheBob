import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useNotification } from '../../context/NotificationContext';
import { usePreferences } from '../../context/PreferencesContext';
import '../../styles/Products.css';

export default function Products() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addNotification } = useNotification();
  const { t } = usePreferences();
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    if (!filtersOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setFiltersOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [filtersOpen]);

  // ✅ FIX: Dùng ref để dùng addNotification trong useCallback mà không cần đưa vào deps
  // Trước đây: addNotification trong deps → fetchProducts thay đổi mỗi render → fetch liên tục
  const addNotificationRef = useRef(addNotification);
  useEffect(() => {
    addNotificationRef.current = addNotification;
  }, [addNotification]);

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const [localFilters, setLocalFilters] = useState({
    query: searchParams.get('query') || '',
    categoryId: searchParams.get('categoryId') || '',
    color: searchParams.get('color') || '',
    minPrice: searchParams.get('minPrice') || '',
    maxPrice: searchParams.get('maxPrice') || '',
  });

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

  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    setFilters(prev => prev.categoryId === localFilters.categoryId
      ? prev : { ...prev, categoryId: localFilters.categoryId });
  }, [localFilters.categoryId]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setFilters(prev => {
        const next = {
        ...prev,
        query: localFilters.query,
        color: localFilters.color,
        minPrice: localFilters.minPrice,
        maxPrice: localFilters.maxPrice,
        };
        return Object.keys(next).every(key => next[key] === prev[key]) ? prev : next;
      });
    }, 400);

    return () => clearTimeout(handler);
  }, [localFilters.query, localFilters.color, localFilters.minPrice, localFilters.maxPrice]);

  useEffect(() => {
    if (!localFilters.query.trim()) {
      setSuggestions([]);
      return;
    }
    const fetchSuggestions = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_API_URL}/products/search?query=${encodeURIComponent(localFilters.query)}`);
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data.slice(0, 5));
        }
      } catch (error) {
        console.error('Failed to fetch search suggestions:', error);
      }
    };
    const handler = setTimeout(fetchSuggestions, 250);
    return () => clearTimeout(handler);
  }, [localFilters.query]);

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

  const fetchProducts = useCallback(async (signal) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.query) params.append('query', filters.query);
      if (filters.categoryId) params.append('categoryId', filters.categoryId);
      if (filters.color) params.append('color', filters.color);
      if (filters.minPrice) params.append('minPrice', filters.minPrice);
      if (filters.maxPrice) params.append('maxPrice', filters.maxPrice);

      const response = await fetch(`${process.env.REACT_APP_API_URL}/products/search?${params}`, { signal });
      if (response.ok) {
        const data = await response.json();
        if (signal.aborted) return;

        setProducts(data);
        setCurrentPage(1);
      }
    } catch (error) {
      if (signal.aborted) return;
      console.error('Failed to fetch products:', error);
      addNotificationRef.current('Lỗi khi tải sản phẩm', 'error');
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    const controller = new AbortController();
    fetchProducts(controller.signal);
    return () => controller.abort();
  }, [fetchProducts]);

  const sortedProducts = useMemo(() => {
    const result = [...products];
    if (sortBy === 'price-low') result.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    else if (sortBy === 'price-high') result.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    else if (sortBy === 'rating') result.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    return result;
  }, [products, sortBy]);

  useEffect(() => { setCurrentPage(1); }, [sortBy]);

  const handleLocalFilterChange = (field, value) => {
    setLocalFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleProductClick = (product) => {
    const identifier = typeof product === 'object' ? (product.slug || product.id) : product;
    navigate(`/product/${identifier}`);
  };

  const indexOfLastProduct = currentPage * productsPerPage;
  const indexOfFirstProduct = indexOfLastProduct - productsPerPage;
  const currentProducts = sortedProducts.slice(indexOfFirstProduct, indexOfLastProduct);
  const totalPages = Math.ceil(products.length / productsPerPage);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="products-page">
      <div className="products-header">
        <h1>{t('products.title')}</h1>
        <p>{t('products.subtitle')}</p>
      </div>

      <div className="products-container">
        {filtersOpen && (
          <button
            type="button"
            className="products-filter-backdrop"
            aria-label={t('products.closeFilters')}
            onClick={() => setFiltersOpen(false)}
          />
        )}
        <aside
          id="products-filter-drawer"
          className={`products-sidebar ${filtersOpen ? 'products-sidebar--open' : ''}`}
          aria-label={t('products.filters')}
          aria-hidden={!filtersOpen}
        >
          <div className="filter-drawer-heading">
            <h2>{t('products.filters')}</h2>
            <button
              type="button"
              className="filter-drawer-close"
              onClick={() => setFiltersOpen(false)}
              aria-label={t('products.closeFilters')}
            >
              ×
            </button>
          </div>
          <div className="filter-section search-filter-section">
            <h3>{t('products.search')}</h3>
            <input
              type="text"
              placeholder={t('products.searchPlaceholder')}
              value={localFilters.query}
              onChange={(e) => handleLocalFilterChange('query', e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              className="filter-input"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="search-suggestions-dropdown">
                {suggestions.map(p => (
                  <div key={p.id} className="suggestion-item" onClick={() => {
                    handleLocalFilterChange('query', p.name);
                    navigate(`/product/${p.slug || p.id}`);
                  }}>
                    <img src={p.mainImageUrl || '/placeholder.jpg'} alt="" />
                    <div className="suggestion-info">
                      <span className="suggestion-name">{p.name}</span>
                      <span className="suggestion-price">
                        {p.price !== undefined && p.price !== null
                          ? p.price.toLocaleString('vi-VN')
                          : p.productVariants?.[0]?.price
                          ? p.productVariants[0].price.toLocaleString('vi-VN')
                          : '0'}{' '}
                        VNĐ
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="filter-section">
            <h3>{t('products.category')}</h3>
            <select
              value={localFilters.categoryId}
              onChange={(e) => handleLocalFilterChange('categoryId', e.target.value)}
              className="filter-select"
              aria-label={t('products.filterByCategory')}
            >
              <option value="">{t('products.allCategories')}</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-section">
            <h3>{t('products.color')}</h3>
            <input
              type="text"
              placeholder={t('products.colorPlaceholder')}
              value={localFilters.color}
              onChange={(e) => handleLocalFilterChange('color', e.target.value)}
              className="filter-input"
            />
          </div>

          <div className="filter-section">
            <h3>{t('products.price')}</h3>
            <div className="price-presets">
              {[
                { label: t('products.allPrices'), min: '', max: '' },
                { label: t('products.under100'), min: '', max: '100000' },
                { label: t('products.range100300'), min: '100000', max: '300000' },
                { label: t('products.range300500'), min: '300000', max: '500000' },
                { label: t('products.over500'), min: '500000', max: '' },
              ].map((preset, index) => {
                const isActive = localFilters.minPrice === preset.min && localFilters.maxPrice === preset.max;
                return (
                  <button
                    key={index}
                    type="button"
                    className={`price-preset-btn ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      setLocalFilters(prev => ({
                        ...prev,
                        minPrice: preset.min,
                        maxPrice: preset.max
                      }));
                    }}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            <div style={{ marginTop: '12px', marginBottom: '6px', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#666', fontWeight: 'bold' }}>
              {t('products.customPrice')}
            </div>
            <div className="price-range">
              <input
                type="number"
                placeholder={t('products.minimumPrice')}
                value={localFilters.minPrice}
                onChange={(e) => handleLocalFilterChange('minPrice', e.target.value)}
                className="filter-input"
                aria-label={t('products.minimumPrice')}
              />
              <span>-</span>
              <input
                type="number"
                placeholder={t('products.maximumPrice')}
                value={localFilters.maxPrice}
                onChange={(e) => handleLocalFilterChange('maxPrice', e.target.value)}
                className="filter-input"
                aria-label={t('products.maximumPrice')}
              />
            </div>
          </div>

          <button
            onClick={() => {
              const reset = { query: '', categoryId: '', color: '', minPrice: '', maxPrice: '' };
              setLocalFilters(reset);
              setFilters(reset);
            }}
            className="btn-clear-filters"
          >
            {t('products.clearFilters')}
          </button>
        </aside>

        {/* Main Content */}
        <main className="products-main">
          <div className="products-top">
            <button
              type="button"
              className="products-filter-toggle"
              onClick={() => setFiltersOpen(true)}
              aria-label={t('products.openFilters')}
              aria-expanded={filtersOpen}
              aria-controls="products-filter-drawer"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 6h16M7 12h10m-7 6h4" />
                <circle cx="8" cy="6" r="1.5" />
                <circle cx="15" cy="12" r="1.5" />
                <circle cx="12" cy="18" r="1.5" />
              </svg>
              <span>{t('products.filter')}</span>
            </button>
            <div className="product-count">
              {loading ? t('products.loading') : t('products.count').replace('{count}', products.length)}
            </div>
            <div className="sort-select">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                aria-label={t('products.sort')}
              >
                <option value="newest">{t('products.sortNewest')}</option>
                <option value="price-low">{t('products.sortPriceLow')}</option>
                <option value="price-high">{t('products.sortPriceHigh')}</option>
                <option value="rating">{t('products.sortRating')}</option>
              </select>
            </div>
          </div>

          {products.length === 0 && !loading ? (
            <div className="no-products">{t('products.none')}</div>
          ) : (
            <>
              <div className={`products-grid ${loading ? 'grid-loading' : ''}`}>
                {loading && products.length === 0 ? (
                  <div className="loading-placeholder" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '100px', fontSize: '0.9rem', color: '#666', letterSpacing: '0.05em' }}>
                    {t('products.loadingProducts')}
                  </div>
                ) : (
                  currentProducts.map((product) => {
                    const colorsMap = new Map();
                    (product.variants || product.productVariants || []).forEach(v => {
                      const cId = v.colorId ?? v.ColorId;
                      const cName = v.color ?? v.Color;
                      const cHex = v.hexCode ?? v.HexCode;
                      if (cId && cHex && !colorsMap.has(cId)) {
                        colorsMap.set(cId, { id: cId, name: cName, hexCode: cHex });
                      }
                    });
                    const productColors = Array.from(colorsMap.values());

                    return (
                      <div key={product.id} className="product-card">
                        <div
                          className="product-image-container"
                          onClick={() => handleProductClick(product)}
                        >
                          <img
                            src={product.mainImageUrl || '/placeholder.jpg'}
                            alt={product.name}
                            className="product-image"
                          />
                          {product.isFeatured && <span className="badge-featured">{t('products.featured')}</span>}
                          {(product.productVariants ?? []).reduce(
                            (sum, v) => sum + (Number(v.stock ?? v.Stock) || 0), 0
                          ) === 0 && (
                            <span className="badge-sold-out">{t('products.soldOut')}</span>
                          )}
                        </div>
                        <div className="product-info">
                          <h3 className="product-name" onClick={() => handleProductClick(product)}>
                            {product.name}
                          </h3>
                          <div className="product-card-colors" style={{ display: 'flex', gap: '6px', alignItems: 'center', height: '20px', margin: '8px 0' }}>
                            {productColors.slice(0, 3).map(color => (
                              <span 
                                key={color.id} 
                                title={color.name}
                                style={{ 
                                  width: '12px', 
                                  height: '12px', 
                                  borderRadius: '50%', 
                                  backgroundColor: color.hexCode, 
                                  border: '1px solid #ccc',
                                  display: 'inline-block'
                                }} 
                              />
                            ))}
                            {productColors.length > 3 && (
                              <span style={{ fontSize: '0.72rem', color: '#666', fontWeight: '500' }}>
                                +{productColors.length - 3}
                              </span>
                            )}
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
                            onClick={() => handleProductClick(product)}
                            className="btn-add-to-cart"
                          >
                            {t('products.details')}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {totalPages > 1 && products.length > 0 && (
                <div className="bob-pagination">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="pagination-arrow"
                  >
                    {t('products.previous')}
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
                    {t('products.next')}
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
