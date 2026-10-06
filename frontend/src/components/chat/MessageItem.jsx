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

export default function MessageItem({
  message,
  isOwn,
  showAvatar = false,
  avatarLabel = 'T',
  isFloating = true,
}) {
  if (message.senderType === 'System') {
    return (
      <div className="chat-message chat-message--system">
        <div className="chat-message__system-content">{renderFormattedContent(message.content)}</div>
        {message.createdAt && (
          <div className={`chat-message__meta${!isFloating ? ' system-meta' : ''}`}>
            <span>{formatTime(message.createdAt)}</span>
          </div>
        )}
      </div>
    );
  }

  const isBlogMsg = message.messageType === 'BlogPost' || message.metadata?.includes('slug') || message.content?.startsWith('[Bài viết]');
  const isVoucherMsg = message.content?.includes('🎁 Shop đã gửi tặng bạn Voucher:');
  const messageContent = isBlogMsg ? (
    <BlogPostMessageCard message={message} />
  ) : message.imageUrl ? (
    <img className="chat-message__image" src={message.imageUrl} alt="Ảnh trong tin nhắn" />
  ) : isVoucherMsg ? (
    <div className="chat-voucher-card">
      <div className="chat-voucher-card__header">
        <span className="chat-voucher-card__badge">🎁 MÃ GIẢM GIÁ DÀNH TẶNG BẠN</span>
      </div>
      <div className="chat-voucher-card__body">{renderFormattedContent(message.content)}</div>
      {!isOwn && (
        <div className="chat-voucher-card__actions">
          <Link to="/my-vouchers" className="chat-voucher-card__action">🎟️ Xem Kho Voucher</Link>
          <Link to="/my-vouchers" className="chat-voucher-card__action">🛒 Dùng ngay</Link>
        </div>
      )}
    </div>
  ) : (
    <div className="chat-message__content">{renderFormattedContent(message.content)}</div>
  );
  const meta = (
    <div className="chat-message__meta">
      <span>{message.isSending ? 'Đang gửi...' : formatTime(message.createdAt)}</span>
      {isOwn && !message.isSending && (isFloating || message.isRead) && (
        <span className="chat-message__read">{message.isRead ? 'Đã xem' : 'Đã gửi'}</span>
      )}
    </div>
  );

  if (!isFloating) {
    return (
      <div className={`chat-message ${isOwn ? 'chat-message--own' : 'chat-message--other'} ${message.isSending ? 'chat-message--sending' : ''}`}>
        <div className={`chat-message__bubble${isBlogMsg ? ' chat-message__blog-bubble' : ''}${isVoucherMsg ? ' chat-message__voucher-bubble' : ''}`}>
          {messageContent}
          {meta}
        </div>
      </div>
    );
  }

  return (
    <div className={`chat-message ${isOwn ? 'chat-message--own' : 'chat-message--other'} ${message.isSending ? 'chat-message--sending' : ''}`}>
      {!isOwn && (
        showAvatar
          ? <span className="chat-message__avatar" aria-hidden="true">{avatarLabel}</span>
          : <span className="chat-message__avatar chat-message__avatar--placeholder" aria-hidden="true" />
      )}
      <div className="chat-message__body">
        <div className={`chat-message__bubble${isBlogMsg ? ' chat-message__blog-bubble' : ''}${isVoucherMsg ? ' chat-message__voucher-bubble' : ''}`}>
          {messageContent}
        </div>
        {meta}
      </div>
    </div>
  );
}