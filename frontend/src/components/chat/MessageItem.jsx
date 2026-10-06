import React from 'react';
import { Link } from 'react-router-dom';
import BlogPostMessageCard from '../blog/BlogPostMessageCard';
import '../../styles/Chat.css';

const formatTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
};

const renderFormattedContent = (text) => {
  if (!text) return null;

  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      const href = part.startsWith('www.') ? `http://${part}` : part;
      return (
        <a
          key={index}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="chat-message__link"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return part;
  });
};

export default function MessageItem({ message, isOwn }) {
  if (message.senderType === 'System') {
    return (
      <div className="chat-message chat-message--system">
        <div className="chat-message__system-content">{renderFormattedContent(message.content)}</div>
        <div className="chat-message__meta system-meta">
          <span>{formatTime(message.createdAt)}</span>
        </div>
      </div>
    );
  }

  const isBlogMsg = message.messageType === 'BlogPost' || message.metadata?.includes('slug') || message.content?.startsWith('[Bài viết]');

  if (isBlogMsg) {
    return (
      <div className={`chat-message ${isOwn ? 'chat-message--own' : 'chat-message--other'} ${message.isSending ? 'chat-message--sending' : ''}`}>
        <div className="chat-message__bubble chat-message__blog-bubble">
          <BlogPostMessageCard message={message} />
          <div className="chat-message__meta">
            <span>{message.isSending ? 'Đang gửi...' : formatTime(message.createdAt)}</span>
            {isOwn && !message.isSending && message.isRead && <span className="chat-message__read">Đã xem</span>}
          </div>
        </div>
      </div>
    );
  }

  const isVoucherMsg = message.content?.includes('🎁 Shop đã gửi tặng bạn Voucher:');

  if (isVoucherMsg) {
    return (
      <div className={`chat-message ${isOwn ? 'chat-message--own' : 'chat-message--other'} ${message.isSending ? 'chat-message--sending' : ''}`}>
        <div className="chat-message__bubble chat-message__voucher-bubble">
          <div className="chat-voucher-card">
            <div className="chat-voucher-card__header">
              <span className="chat-voucher-card__badge">🎁 MÃ GIẢM GIÁ DÀNH TẶNG BẠN</span>
            </div>
            <div className="chat-voucher-card__body">
              {renderFormattedContent(message.content)}
            </div>
            {!isOwn && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                <Link to="/my-vouchers" className="chat-voucher-card__action">
                  🎟️ Xem Kho Voucher
                </Link>
                <Link
                  to="/my-vouchers"
                  className="chat-voucher-card__action"
                  style={{ backgroundColor: '#2563eb', color: '#fff', borderColor: '#2563eb' }}
                >
                  🛒 Dùng ngay
                </Link>
              </div>
            )}
          </div>
          <div className="chat-message__meta">
            <span>{message.isSending ? 'Đang gửi...' : formatTime(message.createdAt)}</span>
            {isOwn && !message.isSending && message.isRead && <span className="chat-message__read">Đã xem</span>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`chat-message ${isOwn ? 'chat-message--own' : 'chat-message--other'} ${message.isSending ? 'chat-message--sending' : ''}`}>
      <div className="chat-message__bubble">
        <div className="chat-message__content">{renderFormattedContent(message.content)}</div>
        <div className="chat-message__meta">
          <span>{message.isSending ? 'Đang gửi...' : formatTime(message.createdAt)}</span>
          {isOwn && !message.isSending && message.isRead && <span className="chat-message__read">Đã xem</span>}
        </div>
      </div>
    </div>
  );
}