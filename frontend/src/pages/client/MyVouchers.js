import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { promotionsAPI } from '../../api/app';
import { useCart } from '../../context/CartContext';
import { useNotification } from '../../context/NotificationContext';
import { usePreferences } from '../../context/PreferencesContext';
import EligibleProductsModal from '../../components/EligibleProductsModal';
import '../../styles/MyVouchers.css';

export default function MyVouchers() {
  const navigate = useNavigate();
  const { getTotalPrice } = useCart();
  const { addNotification } = useNotification();
  const { t, locale } = usePreferences();
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | available | used | expired
  const [copied, setCopied] = useState(null);
  const [selectedPromoId, setSelectedPromoId] = useState(null);
  const [selectedPromoName, setSelectedPromoName] = useState('');

  const handleUseNow = (v) => {
    const cartTotal = getTotalPrice();
    if (v.minOrderValue > 0 && cartTotal < v.minOrderValue) {
      addNotification(
        t('vouchers.cartBelowMinimum')
          .replace('{total}', cartTotal.toLocaleString(locale))
          .replace('{minimum}', v.minOrderValue.toLocaleString(locale)),
        'info'
      );
      setSelectedPromoId(v.promotionId);
      setSelectedPromoName(v.promotionName);
    } else {
      navigate('/checkout');
    }
  };

  useEffect(() => {
    promotionsAPI.getMyVouchers()
      .then(res => {
        const raw = res?.data ?? res;
        setVouchers(Array.isArray(raw) ? raw : (raw?.items || []));
      })
      .catch((err) => {
        console.error('Failed to fetch my vouchers:', err);
        setVouchers([]);
      })
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
    if (v.discountType === 'Percentage') return t('vouchers.discount.percent').replace('{value}', v.discountValue);
    if (v.discountType === 'FixedAmount') return t('vouchers.discount.amount').replace('{value}', v.discountValue.toLocaleString(locale));
    if (v.discountType === 'FreeShipping') return t('vouchers.discount.shipping');
    return v.discountType;
  };

  const formatExpiry = (v) => {
    const d = v.expiresAt || v.promotionEndDate;
    if (!d) return t('vouchers.noLimit');
    return t('vouchers.expiry').replace('{date}', new Date(d).toLocaleDateString(locale));
  };

  if (loading) return (
    <div className="mv-loading">
      <div className="mv-spinner" />
      <p>{t('vouchers.loading')}</p>
    </div>
  );

  return (
    <div className="mv-page">
      <div className="mv-header">
        <h1>{t('vouchers.title')}</h1>
        <p className="mv-subtitle">{t('vouchers.subtitle')}</p>
      </div>

      <div className="mv-filters">
        {[
          { key: 'all', label: t('vouchers.filter.all'), count: vouchers.length },
          { key: 'available', label: t('vouchers.filter.available'), count: vouchers.filter(v => !v.isUsed && !v.isExpired).length },
          { key: 'used', label: t('vouchers.filter.used'), count: vouchers.filter(v => v.isUsed).length },
          { key: 'expired', label: t('vouchers.filter.expired'), count: vouchers.filter(v => v.isExpired).length },
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
          <h3>{t('vouchers.empty.title')}</h3>
          <p>{t('vouchers.empty.description')}</p>
        </div>
      )}

      <div className="mv-grid">
        {filtered.map(v => (
          <div key={v.id} className={`mv-card ${v.isUsed ? 'used' : v.isExpired ? 'expired' : 'available'}`}>
            <div className="mv-card-stripe" />
            <div className="mv-card-body">
              <div className="mv-discount">
                <span className="mv-discount-value">{formatDiscount(v)}</span>
                {v.maxDiscountAmount && <span className="mv-discount-cap">{t('vouchers.maximum').replace('{value}', v.maxDiscountAmount.toLocaleString(locale))}</span>}
              </div>

              <div className="mv-card-info">
                <h3 className="mv-card-name">{v.promotionName}</h3>
                {v.description && <p className="mv-card-desc">{v.description}</p>}
                {v.note && <p className="mv-card-note">📝 {v.note}</p>}
                <div className="mv-card-meta">
                  {v.minOrderValue > 0 && (
                    <span className="mv-meta-item">{t('vouchers.minimumOrder').replace('{value}', v.minOrderValue.toLocaleString(locale))}</span>
                  )}
                  <span className="mv-meta-item mv-expiry">📅 {formatExpiry(v)}</span>
                </div>
              </div>

              <div className="mv-card-footer">
                {v.isUsed ? (
                  <div className="mv-status used">
                    {v.usedAt
                      ? t('vouchers.usedAtDate').replace('{date}', new Date(v.usedAt).toLocaleDateString(locale))
                      : t('vouchers.usedAt')}
                  </div>
                ) : v.isExpired ? (
                  <div className="mv-status expired">{t('vouchers.expired')}</div>
                ) : (
                  <div className="mv-action-row" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="mv-eligible-btn"
                      onClick={() => {
                        setSelectedPromoId(v.promotionId);
                        setSelectedPromoName(v.promotionName);
                      }}
                    >
                      {t('vouchers.eligibleProducts')}
                    </button>
                    <button
                      type="button"
                      className="mv-use-now-btn"
                      style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
                      onClick={() => handleUseNow(v)}
                    >
                      {t('vouchers.useNow')}
                    </button>
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

      {selectedPromoId && (
        <EligibleProductsModal
          promotionId={selectedPromoId}
          promotionName={selectedPromoName}
          onClose={() => setSelectedPromoId(null)}
        />
      )}
    </div>
  );
}
