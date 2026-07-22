import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { promotionsAPI } from '../api/app';
import '../styles/MyVouchers.css';

const unwrap = (res) => res?.data ?? res;

export default function EligibleProductsModal({ promotionId, promotionName, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'single_meets'
  const navigate = useNavigate();

  useEffect(() => {
    if (!promotionId) return;
    setLoading(true);
    promotionsAPI.getEligibleProducts(promotionId)
      .then((res) => {
        const payload = unwrap(res);
        setData(payload);
      })
      .catch((err) => {
        console.error('Failed to load eligible products:', err);
        setError('Không thể tải danh sách sản phẩm cho voucher này.');
      })
      .finally(() => setLoading(false));
  }, [promotionId]);

  const rawProducts = data?.products || [];
  const minOrderVal = data?.minOrderValue || 0;

  const displayProducts = rawProducts.filter(p => {
    if (filterMode === 'single_meets') {
      return p.meetsMinOrderSingle || (minOrderVal > 0 && p.minPrice >= minOrderVal);
    }
    return true;
  });

  return (
    <div className="mv-modal-overlay" onClick={onClose}>
      <div className="mv-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '850px', width: '90%' }}>
        <div className="mv-modal-header">
          <h3>🛍️ Sản phẩm áp dụng Voucher</h3>
          <button type="button" className="mv-modal-close" onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <div className="mv-modal-loading">
            <div className="mv-spinner" />
            <p>Đang kiểm tra sản phẩm đủ điều kiện...</p>
          </div>
        ) : error ? (
          <div className="mv-modal-error">{error}</div>
        ) : !data ? null : (
          <div className="mv-modal-body">
            <div className="mv-promo-info-banner">
              <h4>{data.promotionName || promotionName}</h4>
              <p className="mv-promo-scope-text">
                {data.isAllShop
                  ? '🌟 Voucher áp dụng cho toàn bộ cửa hàng!'
                  : '📌 Voucher áp dụng cho các sản phẩm bên dưới:'}
              </p>
              {minOrderVal > 0 && (
                <div style={{ marginTop: '6px', fontSize: '0.9rem', color: '#1e293b', fontWeight: 600 }}>
                  🛒 Đơn hàng tối thiểu: <span style={{ color: '#e11d48' }}>{Number(minOrderVal).toLocaleString('vi-VN')}₫</span>
                  <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 400, color: '#64748b', marginTop: '2px' }}>
                    💡 Các sản phẩm có giá thấp hơn vẫn hợp lệ khi mua tổng đơn đạt mốc trên.
                  </span>
                </div>
              )}
            </div>

            {minOrderVal > 0 && (
              <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    backgroundColor: filterMode === 'all' ? '#2563eb' : '#f8fafc',
                    color: filterMode === 'all' ? '#ffffff' : '#475569'
                  }}
                  onClick={() => setFilterMode('all')}
                >
                  Tất cả sản phẩm hợp lệ ({rawProducts.length})
                </button>
                <button
                  type="button"
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    backgroundColor: filterMode === 'single_meets' ? '#16a34a' : '#f8fafc',
                    color: filterMode === 'single_meets' ? '#ffffff' : '#475569'
                  }}
                  onClick={() => setFilterMode('single_meets')}
                >
                  🔥 Đạt đơn 200k khi mua 1 sản phẩm (≥ {Number(minOrderVal).toLocaleString('vi-VN')}₫)
                </button>
              </div>
            )}

            {displayProducts.length > 0 ? (
              <div className="mv-products-grid">
                {displayProducts.map((p) => {
                  const isSingleMeet = minOrderVal <= 0 || p.minPrice >= minOrderVal;
                  const suggestedQty = p.suggestedQty || (minOrderVal > 0 ? Math.ceil(minOrderVal / (p.minPrice || 1)) : 1);

                  return (
                    <div key={p.id} className="mv-product-card" onClick={() => { onClose(); navigate(`/products/${p.id}`); }}>
                      <div className="mv-product-img-box" style={{ position: 'relative' }}>
                        {p.mainImageUrl ? (
                          <img src={p.mainImageUrl} alt={p.name} />
                        ) : (
                          <div className="mv-no-img">🛍️</div>
                        )}
                        {minOrderVal > 0 && (
                          <span style={{
                            position: 'absolute',
                            top: '6px',
                            left: '6px',
                            backgroundColor: isSingleMeet ? '#16a34a' : '#f59e0b',
                            color: '#ffffff',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
                          }}>
                            {isSingleMeet ? '✅ Đủ đơn 1 SP' : `💡 Cần mua x${suggestedQty}`}
                          </span>
                        )}
                      </div>
                      <div className="mv-product-details">
                        <p className="mv-product-title">{p.name}</p>
                        <p className="mv-product-price">
                          {Number(p.minPrice).toLocaleString('vi-VN')}₫
                        </p>
                        <button type="button" className="mv-product-buy-btn">
                          Xem chi tiết
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mv-modal-empty" style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
                Không có sản phẩm nào phù hợp với bộ lọc đã chọn.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
