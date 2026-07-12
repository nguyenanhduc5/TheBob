import { useState, useEffect } from 'react';
import { promotionsAPI } from '../api/app';
import '../styles/MyVouchers.css';

export default function MyVouchers() {
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | available | used | expired
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    promotionsAPI.getMyVouchers()
      .then(data => setVouchers(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = vouchers.filter(v => {
    if (filter === 'available') return !v.isUsed && !v.isExpired;
    if (filter === 'used') return v.isUsed;
    if (filter === 'expired') return v.isExpired;
    return true;
  });

  const copyCode = async (code) => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(null), 2000);
    } catch {}
  };

  const formatDiscount = (v) => {
    if (v.discountType === 'Percentage') return `Giảm ${v.discountValue}%`;
    if (v.discountType === 'FixedAmount') return `Giảm ${v.discountValue.toLocaleString('vi-VN')}₫`;
    if (v.discountType === 'FreeShipping') return 'Miễn phí vận chuyển';
    return v.discountType;
  };

  const formatExpiry = (v) => {
    const d = v.expiresAt || v.promotionEndDate;
    if (!d) return 'Không giới hạn';
    return `HSD: ${new Date(d).toLocaleDateString('vi-VN')}`;
  };

  if (loading) return (
    <div className="mv-loading">
      <div className="mv-spinner" />
      <p>Đang tải voucher...</p>
    </div>
  );

  return (
    <div className="mv-page">
      <div className="mv-header">
        <h1>🎁 Voucher của tôi</h1>
        <p className="mv-subtitle">Các voucher và mã giảm giá dành riêng cho bạn</p>
      </div>

      <div className="mv-filters">
        {[
          { key: 'all', label: 'Tất cả', count: vouchers.length },
          { key: 'available', label: '✅ Khả dụng', count: vouchers.filter(v => !v.isUsed && !v.isExpired).length },
          { key: 'used', label: '✓ Đã dùng', count: vouchers.filter(v => v.isUsed).length },
          { key: 'expired', label: '❌ Hết hạn', count: vouchers.filter(v => v.isExpired).length },
        ].map(f => (
          <button
            key={f.key}
            className={`mv-filter-btn ${filter === f.key ? 'active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label} <span className="mv-count">{f.count}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="mv-empty">
          <div className="mv-empty-icon">🎟️</div>
          <h3>Không có voucher nào</h3>
          <p>Hãy mua sắm để nhận voucher ưu đãi từ THEBOB!</p>
        </div>
      )}

      <div className="mv-grid">
        {filtered.map(v => (
          <div key={v.id} className={`mv-card ${v.isUsed ? 'used' : v.isExpired ? 'expired' : 'available'}`}>
            <div className="mv-card-stripe" />
            <div className="mv-card-body">
              <div className="mv-discount">
                <span className="mv-discount-value">{formatDiscount(v)}</span>
                {v.maxDiscountAmount && <span className="mv-discount-cap">Tối đa {v.maxDiscountAmount.toLocaleString('vi-VN')}₫</span>}
              </div>

              <div className="mv-card-info">
                <h3 className="mv-card-name">{v.promotionName}</h3>
                {v.description && <p className="mv-card-desc">{v.description}</p>}
                {v.note && <p className="mv-card-note">📝 {v.note}</p>}
                <div className="mv-card-meta">
                  {v.minOrderValue > 0 && (
                    <span className="mv-meta-item">🛒 Đơn từ {v.minOrderValue.toLocaleString('vi-VN')}₫</span>
                  )}
                  <span className="mv-meta-item mv-expiry">📅 {formatExpiry(v)}</span>
                </div>
              </div>

              <div className="mv-card-footer">
                {v.isUsed ? (
                  <div className="mv-status used">✓ Đã sử dụng {v.usedAt ? `lúc ${new Date(v.usedAt).toLocaleDateString('vi-VN')}` : ''}</div>
                ) : v.isExpired ? (
                  <div className="mv-status expired">✕ Đã hết hạn</div>
                ) : (
                  <div className="mv-action-row">
                    <div className="mv-status available">✅ Khả dụng</div>
                    <span className="mv-hint">Voucher tự động áp dụng khi thanh toán</span>
                  </div>
                )}
              </div>
            </div>

            {/* Perforated edge */}
            <div className="mv-perforations">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="mv-hole" />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
