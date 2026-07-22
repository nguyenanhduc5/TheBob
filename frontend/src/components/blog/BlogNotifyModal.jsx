import React, { useState } from 'react';
import { blogNotificationsAPI } from '../../api/app';

export default function BlogNotifyModal({ blogPost, onClose, onSuccess }) {
  const [targetType, setTargetType] = useState('All'); // All | Segment | Manual
  const [title, setTitle] = useState(blogPost ? `[Bài viết mới] ${blogPost.title}` : '');
  const [body, setBody] = useState(blogPost ? (blogPost.summary || 'Khám phá bài viết mới nhất từ THEBOB ngay!') : '');
  const [userIdsStr, setUserIdsStr] = useState('');
  const [minOrders, setMinOrders] = useState(0);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!title.trim()) {
      setErrorMsg('Vui lòng nhập tiêu đề thông báo.');
      return;
    }

    let userIds = [];
    if (targetType === 'Manual') {
      userIds = userIdsStr
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n) && n > 0);
      if (userIds.length === 0) {
        setErrorMsg('Vui lòng nhập danh sách User ID hợp lệ (phân cách bằng dấu phẩy).');
        return;
      }
    }

    let segmentConfig = null;
    if (targetType === 'Segment' && minOrders > 0) {
      segmentConfig = JSON.stringify({ minOrders: Number(minOrders) });
    }

    setSending(true);
    try {
      await blogNotificationsAPI.send({
        blogPostId: blogPost?.id || null,
        title: title.trim(),
        body: body.trim(),
        targetType,
        userIds,
        segmentConfig,
      });

      onSuccess?.('Đã gửi thông báo thành công!');
      onClose();
    } catch (err) {
      setErrorMsg(err?.message || 'Không thể gửi thông báo. Vui lòng thử lại.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content blog-notify-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>📢 Gửi Thông Báo Bài Viết</h3>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {errorMsg && <div className="modal-error-alert">{errorMsg}</div>}

          {blogPost && (
            <div className="notify-post-preview">
              <img src={blogPost.thumbnail || '/placeholder.jpg'} alt={blogPost.title} />
              <div>
                <strong>{blogPost.title}</strong>
                <span>/blog/{blogPost.slug}</span>
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Đối tượng nhận (*)</label>
            <select value={targetType} onChange={(e) => setTargetType(e.target.value)}>
              <option value="All">Tất cả người dùng (All Active Users)</option>
              <option value="Segment">Theo phân khúc (Segment)</option>
              <option value="Manual">Chọn tay danh sách User ID (Manual)</option>
            </select>
          </div>

          {targetType === 'Segment' && (
            <div className="form-group">
              <label>Số đơn hàng tối thiểu (minOrders)</label>
              <input
                type="number"
                value={minOrders}
                onChange={(e) => setMinOrders(e.target.value)}
                placeholder="Ví dụ: 3 (gửi cho khách đã mua từ 3 đơn trở lên)"
              />
            </div>
          )}

          {targetType === 'Manual' && (
            <div className="form-group">
              <label>Danh sách User ID (phân cách bằng dấu phẩy)</label>
              <input
                type="text"
                value={userIdsStr}
                onChange={(e) => setUserIdsStr(e.target.value)}
                placeholder="1, 4, 12, 25"
              />
            </div>
          )}

          <div className="form-group">
            <label>Tiêu đề thông báo (*)</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nhập tiêu đề thông báo..."
              required
            />
          </div>

          <div className="form-group">
            <label>Nội dung thông báo</label>
            <textarea
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Nhập chi tiết nội dung tin nhắn..."
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={sending}>
              Hủy
            </button>
            <button type="submit" className="btn-primary" disabled={sending}>
              {sending ? 'Đang gửi...' : 'Gửi Thông Báo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
