import React, { useEffect, useMemo, useRef } from 'react';
import MessageItem from './MessageItem';

const getSenderLabel = (message, isOwn) => {
  if (message.senderType === 'Admin') return message.senderName || (isOwn ? 'Bạn' : 'Admin');
  if (message.senderType === 'User') return message.senderName || (isOwn ? 'Bạn' : 'Khách');
  if (message.senderType === 'AI') return message.senderName || 'AI';
  return message.senderType;
};

// Khoá để xác định 2 tin nhắn liên tiếp có cùng người gửi hay không
const getSenderKey = (message) =>
  `${message.senderType}:${message.senderId ?? message.senderName ?? 'unknown'}`;

export default function MessageList({ messages, currentUserId, isAdmin, typingUserId }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUserId]);

  const isOwnMessage = (message) => {
    // Tin nhắn tạm (isSending) chưa có senderId từ server — dùng senderType để xác định
    if (message.isSending) {
      return isAdmin ? message.senderType === 'Admin' : message.senderType === 'User';
    }
    if (isAdmin) return message.senderType === 'Admin';
    return message.senderType === 'User' && message.senderId === currentUserId;
  };

  // Gom các tin nhắn liên tiếp cùng người gửi thành từng nhóm,
  // mỗi nhóm chỉ hiện tên người gửi 1 lần ở phía trên (kiểu Zalo/Messenger)
  const groups = useMemo(() => {
    const result = [];
    messages.forEach((message) => {
      if (message.senderType === 'System') {
        result.push({ type: 'system', key: message.id, message });
        return;
      }

      const own = isOwnMessage(message);
      const senderKey = getSenderKey(message);
      const lastGroup = result[result.length - 1];

      if (lastGroup && lastGroup.type === 'messages' && lastGroup.senderKey === senderKey) {
        lastGroup.items.push(message);
      } else {
        result.push({
          type: 'messages',
          key: `group-${message.id}`,
          senderKey,
          senderLabel: getSenderLabel(message, own),
          isOwn: own,
          items: [message],
        });
      }
    });
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, isAdmin, currentUserId]);

  return (
    <div className="chat-message-list">
      {messages.length === 0 && (
        <div className="chat-message-list__empty">
          Chưa có tin nhắn. Hãy bắt đầu cuộc trò chuyện!
        </div>
      )}

      {groups.map((group) => {
        if (group.type === 'system') {
          return <MessageItem key={group.key} message={group.message} isOwn={false} />;
        }

        return (
          <div
            key={group.key}
            className={`chat-message-group ${group.isOwn ? 'chat-message-group--own' : 'chat-message-group--other'}`}
          >
            <div className="chat-message-group__sender">{group.senderLabel}</div>
            {group.items.map((message) => (
              <MessageItem key={message.id} message={message} isOwn={group.isOwn} />
            ))}
          </div>
        );
      })}

      {typingUserId && typingUserId !== currentUserId && (
        <div className="chat-typing-indicator">Đang nhập...</div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}