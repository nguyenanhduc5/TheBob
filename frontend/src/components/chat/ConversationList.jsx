import React from 'react';
import '../../styles/Chat.css';

const formatRelative = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Vừa xong';
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} giờ trước`;
  return d.toLocaleDateString('vi-VN');
};

export default function ConversationList({ conversations, selectedId, onSelect }) {
  if (!conversations.length) {
    return (
      <div className="conversation-list conversation-list--empty">
        Chưa có hội thoại nào.
      </div>
    );
  }

  return (
    <div className="conversation-list">
      {conversations.map((conv) => (
        <button
          key={conv.id}
          type="button"
          className={`conversation-list__item ${selectedId === conv.id ? 'active' : ''}`}
          onClick={() => onSelect(conv)}
        >
          <div className="conversation-list__top">
            <span className="conversation-list__name">
              {conv.userName || conv.userEmail || `User #${conv.userId}`}
            </span>
            {conv.unreadCount > 0 && (
              <span className="conversation-list__badge">{conv.unreadCount}</span>
            )}
          </div>
          <div className="conversation-list__preview">
            {conv.lastMessagePreview || 'Chưa có tin nhắn'}
          </div>
          <div className="conversation-list__meta">
            <span className={`conversation-list__status status-${conv.status?.toLowerCase()}`}>
              {conv.status === 'Open' ? 'Đang mở' : 'Đã đóng'}
            </span>
            <span>{formatRelative(conv.updatedAt)}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
