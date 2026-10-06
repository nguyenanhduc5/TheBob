import React, { useEffect, useState } from 'react';
import { productsAPI, chatAPI, ordersAPI, recommendationAPI } from '../../api/app';
import '../../styles/ProductContextCard.css';

const getStatusBadge = (status) => {
  const map = {
    0: 'Chờ xử lý',
    1: 'Đang xử lý',
    2: 'Đã thanh toán',
    3: 'Đang giao',
    4: 'Đã giao',
    5: 'Đã hủy',
    6: 'Chờ thanh toán',
    Pending: 'Chờ xử lý',
    Processing: 'Đang xử lý',
    Paid: 'Đã thanh toán',
    Shipped: 'Đang giao',
    Delivered: 'Đã giao',
    Cancelled: 'Đã hủy',
  };
  return map[status] || status;
};

export default function ProductContextCard({
  productId,
  onSelectProduct,
  onClearProduct,
  onSendOrderMessage,
}) {
  const [product, setProduct] = useState(null);
  const [activeTab, setActiveTab] = useState(null); // null | 'trending' | 'orders' | 'search'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [trendingProducts, setTrendingProducts] = useState([]);
  const [userOrders, setUserOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(false);

  // Load thông tin sản phẩm nếu có productId
  useEffect(() => {
    if (!productId) {
      setProduct(null);
      return;
    }

    setLoadingProduct(true);
    productsAPI
      .getProduct(productId)
      .then((res) => setProduct(res?.data ?? res))
      .catch(() => setProduct(null))
      .finally(() => setLoadingProduct(false));
  }, [productId]);

  // Mở tab sản phẩm gợi ý
  const handleOpenTrending = async () => {
    if (activeTab === 'trending') {
      setActiveTab(null);
      return;
    }
    setActiveTab('trending');
    setLoading(true);
    try {
      const res = await recommendationAPI.getTrending(6);
      const list = res?.data ?? res ?? [];
      setTrendingProducts(Array.isArray(list) ? list : []);
    } catch {
      try {
        const res = await productsAPI.getProducts();
        const list = Array.isArray(res) ? res.slice(0, 6) : [];
        setTrendingProducts(list);
      } catch {
        setTrendingProducts([]);
      }
    } finally {
      setLoading(false);
    }
  };

  // Mở tab đơn hàng của tôi
  const handleOpenOrders = async () => {
    if (activeTab === 'orders') {
      setActiveTab(null);
      return;
    }
    setActiveTab('orders');
    setLoading(true);
    try {
      const list = await ordersAPI.getUserOrders();
      setUserOrders(Array.isArray(list) ? list.slice(0, 5) : []);
    } catch (err) {
      console.error('Failed to load user orders:', err);
      setUserOrders([]);
    } finally {
      setLoading(false);
    }
  };

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
    setActiveTab(null);
    onSelectProduct(id);
  };

  const handleSelectOrder = (order) => {
    setActiveTab(null);
    if (onSendOrderMessage) {
      const orderCodeStr = order.orderCode ? `#${order.orderCode}` : `#${order.id}`;
      const statusText = getStatusBadge(order.status);
      const totalStr = order.totalAmount ? `${Number(order.totalAmount).toLocaleString('vi-VN')}đ` : '';
      onSendOrderMessage(
        `Tôi cần hỗ trợ về đơn hàng ${orderCodeStr} (Trạng thái: ${statusText}${totalStr ? `, Tổng tiền: ${totalStr}` : ''})`
      );
    }
  };

  const handleClear = () => {
    setSearchQuery('');
    setSearchResults([]);
    setActiveTab(null);
    onClearProduct?.();
  };

  if (loadingProduct) {
    return <div className="product-context-card loading">Đang tải sản phẩm...</div>;
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
            <span className="product-context-card__badge">📦 Đang tư vấn về sản phẩm</span>
            <p className="product-context-card__name">{product.name}</p>
          </div>
        </div>
        <button
          type="button"
          className="product-context-card__clear"
          onClick={handleClear}
          title="Bỏ chọn sản phẩm này"
        >
          ✕
        </button>
      </div>
    );
  }

  // Hiển thị ô tìm kiếm + Các nút hành động nhanh (Gợi ý SP / Đơn hàng)
  return (
    <div className="product-context-card search-mode">
      <div className="product-context-card__search-row">
        <input
          type="text"
          placeholder="🔍 Tìm sản phẩm hoặc chọn bên dưới..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (e.target.value.trim()) setActiveTab('search');
            else setActiveTab(null);
          }}
          className="product-context-card__search-input"
          autoComplete="off"
        />
        {searchQuery && (
          <button
            type="button"
            className="product-context-card__clear-search"
            onClick={() => {
              setSearchQuery('');
              setSearchResults([]);
              setActiveTab(null);
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Tabs gợi ý nhanh */}
      <div className="product-context-card__quick-actions">
        <button
          type="button"
          className={`product-context-card__tab-btn ${activeTab === 'trending' ? 'active' : ''}`}
          onClick={handleOpenTrending}
        >
          🔥 SP Nổi bật
        </button>
        <button
          type="button"
          className={`product-context-card__tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
          onClick={handleOpenOrders}
        >
          📦 Đơn hàng của tôi
        </button>
      </div>

      {/* Danh sách SP nổi bật */}
      {activeTab === 'trending' && (
        <div className="product-context-card__drawer">
          <div className="product-context-card__drawer-title">🔥 Sản phẩm nổi bật gợi ý:</div>
          {loading ? (
            <div className="product-context-card__loading">Đang tải gợi ý...</div>
          ) : trendingProducts.length === 0 ? (
            <div className="product-context-card__no-result">Chưa có gợi ý nào.</div>
          ) : (
            <ul className="product-context-card__search-results">
              {trendingProducts.map((p) => {
                const img = p.mainImageUrl || p.thumbnail || p.imageUrl;
                const price = p.price || (p.productVariants && p.productVariants[0]?.price);
                return (
                  <li key={p.id} onClick={() => handleSelectProduct(p.id)}>
                    {img ? <img src={img} alt={p.name} /> : <div className="product-img-placeholder">🛍️</div>}
                    <div className="product-context-card__result-info">
                      <span className="product-context-card__result-name">{p.name}</span>
                      {price > 0 && (
                        <span className="product-context-card__result-price">
                          {Number(price).toLocaleString('vi-VN')}đ
                        </span>
                      )}
                    </div>
                    <button type="button" className="product-context-card__select-btn">Hỏi SP</button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Danh sách Đơn hàng của tôi */}
      {activeTab === 'orders' && (
        <div className="product-context-card__drawer">
          <div className="product-context-card__drawer-title">📦 Chọn đơn hàng cần tư vấn:</div>
          {loading ? (
            <div className="product-context-card__loading">Đang tải đơn hàng...</div>
          ) : userOrders.length === 0 ? (
            <div className="product-context-card__no-result">Bạn chưa có đơn hàng nào gần đây.</div>
          ) : (
            <ul className="product-context-card__orders-list">
              {userOrders.map((o) => (
                <li key={o.id} className="product-context-card__order-item" onClick={() => handleSelectOrder(o)}>
                  <div className="product-context-card__order-header">
                    <span className="product-context-card__order-code">
                      Đơn hàng #{o.orderCode || o.id}
                    </span>
                    <span className={`product-context-card__order-status status-${o.status}`}>
                      {getStatusBadge(o.status)}
                    </span>
                  </div>
                  <div className="product-context-card__order-body">
                    <span className="product-context-card__order-price">
                      Tổng: {Number(o.totalAmount || 0).toLocaleString('vi-VN')}đ
                    </span>
                    <span className="product-context-card__order-date">
                      {o.createdAt ? new Date(o.createdAt).toLocaleDateString('vi-VN') : ''}
                    </span>
                  </div>
                  <button type="button" className="product-context-card__order-action">
                    💬 Hỏi về đơn hàng này
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Kết quả tìm kiếm */}
      {activeTab === 'search' && searchQuery.trim() && searchResults.length === 0 && !loading && (
        <div className="product-context-card__no-result">Không tìm thấy sản phẩm phù hợp.</div>
      )}

      {activeTab === 'search' && searchResults.length > 0 && (
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
              <button type="button" className="product-context-card__select-btn">Hỏi SP</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
