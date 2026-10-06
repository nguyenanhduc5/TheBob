import React, { useEffect, useState } from 'react';
import { promotionsAPI } from '../../api/app';
import '../../styles/Chat.css';

const unwrap = (res) => res?.data ?? res;

export default function SendVoucherModal({ userId, userName, onClose, onSendSuccess }) {
  const [promotions, setPromotions] = useState([]);
  const [selectedPromoId, setSelectedPromoId] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    promotionsAPI.getAll({ status: 'Active' })
      .then((res) => {
        const raw = unwrap(res);
        const list = Array.isArray(raw) ? raw : (raw?.items || []);
        setPromotions(list);
        if (list.length > 0) setSelectedPromoId(list[0].id);
      })
      .catch((err) => {
        console.error('Failed to load promotions:', err);
        setError('Không thể tải danh sách Voucher.');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!selectedPromoId || !userId) return;

    const promo = promotions.find((p) => String(p.id) === String(selectedPromoId));
    if (!promo) return;

    setSending(true);
    setError(null);
    try {
      await promotionsAPI.sendUserCoupon({
        userId: Number(userId),
        promotionId: Number(selectedPromoId),
        note: note.trim() || 'Tặng riêng cho bạn từ Shop THEBOB',
      });

      const discountVal = promo.discountType === 'Percentage'
        ? `${promo.discountValue}%`
        : `${Number(promo.discountValue).toLocaleString('vi-VN')}đ`;
      const minOrderVal = promo.minOrderValue > 0
        ? ` cho đơn từ ${Number(promo.minOrderValue).toLocaleString('vi-VN')}đ`
        : '';
      const codeStr = promo.couponCode ? ` (Mã: ${promo.couponCode})` : '';

      const voucherMsg = `🎁 Shop đã gửi tặng bạn Voucher: ${promo.name} - Giảm ${discountVal}${minOrderVal}${codeStr}! ${note.trim() ? `Lời nhắn: "${note.trim()}"` : ''}`;

      onSendSuccess(voucherMsg);
      onClose();
    } catch (err) {
      console.error('Send voucher error:', err);
      setError(err?.message || 'Không thể gửi Voucher (khách hàng có thể đã có mã này chưa sử dụng).');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="chat-modal-overlay" onClick={onClose}>
      <div className="chat-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="chat-modal-header">
          <h3>🎁 Tặng Voucher cho {userName || `Khách #${userId}`}</h3>
          <button type="button" className="chat-modal-close" onClick={onClose}>✕</button>
        </div>

        {error && <div className="chat-modal-error">{error}</div>}

        {loading ? (
          <div className="chat-modal-loading">Đang tải danh sách Voucher...</div>
        ) : promotions.length === 0 ? (
          <div className="chat-modal-empty">Hiện không có Voucher/Khuyến mãi nào đang kích hoạt.</div>
        ) : (
          <form onSubmit={handleSend} className="chat-modal-body">
            <div className="chat-modal-field">
              <label>Chọn Voucher / Khuyến mãi:</label>
              <select
                value={selectedPromoId}
                onChange={(e) => setSelectedPromoId(e.target.value)}
                disabled={sending}
              >
                {promotions.map((p) => {
                  const val = p.discountType === 'Percentage' ? `${p.discountValue}%` : `${Number(p.discountValue).toLocaleString('vi-VN')}đ`;
                  return (
                    <option key={p.id} value={p.id}>
                      {p.name} (Giảm {val}) {p.couponCode ? `- Mã: ${p.couponCode}` : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="chat-modal-field">
              <label>Lời nhắn gửi đính kèm (Tùy chọn):</label>
              <input
                type="text"
                placeholder="VD: Shop tặng bạn ưu đãi riêng ạ!"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={sending}
              />
            </div>

            <div className="chat-modal-actions">
              <button type="button" className="chat-btn-cancel" onClick={onClose} disabled={sending}>
                Hủy
              </button>
              <button type="submit" className="chat-btn-submit" disabled={sending}>
                {sending ? 'Đang gửi...' : '🎁 Gửi Voucher ngay'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
