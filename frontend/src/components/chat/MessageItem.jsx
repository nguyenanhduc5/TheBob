import React from 'react';
import '../../styles/Chat.css';

const formatTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
};

export default function MessageItem({ message, isOwn }) {
  if (message.senderType === 'System') {
    return (
      <div className="chat-message chat-message--system">
        <div className="chat-message__system-content">{message.content}</div>
        <div className="chat-message__meta system-meta">
          <span>{formatTime(message.createdAt)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`chat-message ${isOwn ? 'chat-message--own' : 'chat-message--other'} ${message.isSending ? 'chat-message--sending' : ''}`}>
      <div className="chat-message__bubble">
        <div className="chat-message__content">{message.content}</div>
        <div className="chat-message__meta">
          <span>{message.isSending ? 'Đang gửi...' : formatTime(message.createdAt)}</span>
          {isOwn && !message.isSending && message.isRead && <span className="chat-message__read">Đã xem</span>}
        </div>
      </div>
    </div>
  );
}