import React, { useEffect, useState } from 'react';
import { productsAPI, chatAPI } from '../../api/app';
import '../../styles/ProductContextCard.css';

export default function ProductContextCard({ productId, onSelectProduct, onClearProduct }) {
  const [product, setProduct] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loadingProduct, setLoadingProduct] = useState(false);

  // Load sản phẩm hiện tại
  useEffect(() => {
    if (!productId) {
      setProduct(null);
      return;
    }

    setLoadingProduct(true);
    productsAPI.getProduct(productId)
      .then((res) => setProduct(res?.data ?? res))
      .catch(() => setProduct(null))
      .finally(() => setLoadingProduct(false));
  }, [productId]);

  // Realtime search với debounce 300ms
  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await chatAPI.searchProduct(query);
        const list = res?.data ?? [];
        setSearchResults(list);
      } catch (err) {
        console.error('Search error:', err);
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectProduct = (id) => {
    setSearchQuery('');
    setSearchResults([]);
    onSelectProduct(id);
  };

  const handleClear = () => {
    setSearchQuery('');
    setSearchResults([]);
    onClearProduct?.();
  };

  if (loadingProduct) {
    return <div className="product-context-card loading">Đang tải...</div>;
  }

  // Hiển thị card sản phẩm đang hỏi
  if (product) {
    return (
      <div className="product-context-card active">
        <div className="product-context-card__info">
          {product.mainImageUrl && (
            <img src={product.mainImageUrl} alt={product.name} className="product-context-card__img" />
          )}
          <div className="product-context-card__details">
            <span className="product-context-card__badge">📦 Đang hỏi về</span>
            <p className="product-context-card__name">{product.name}</p>
          </div>
        </div>
        <button
          type="button"
          className="product-context-card__clear"
          onClick={handleClear}
          title="Ngưng hỏi về sản phẩm này"
        >
          ✕
        </button>
      </div>
    );
  }

  // Hiển thị ô tìm kiếm
  return (
    <div className="product-context-card search-mode">
      <div className="product-context-card__search-row">
        <input
          type="text"
          placeholder="🔍 Tìm sản phẩm muốn tư vấn..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="product-context-card__search-input"
          autoComplete="off"
        />
        {searchQuery && (
          <button
            type="button"
            className="product-context-card__clear-search"
            onClick={() => { setSearchQuery(''); setSearchResults([]); }}
          >
            ✕
          </button>
        )}
      </div>

      {searchQuery.trim() && searchResults.length === 0 && (
        <div className="product-context-card__no-result">Không tìm thấy sản phẩm phù hợp.</div>
      )}

      {searchResults.length > 0 && (
        <ul className="product-context-card__search-results">
          {searchResults.map((p) => (
            <li key={p.id} onClick={() => handleSelectProduct(p.id)}>
              {p.thumbnail && <img src={p.thumbnail} alt={p.name} />}
              <div className="product-context-card__result-info">
                <span className="product-context-card__result-name">{p.name}</span>
                {p.price > 0 && (
                  <span className="product-context-card__result-price">
                    {p.price.toLocaleString('vi-VN')}đ
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
