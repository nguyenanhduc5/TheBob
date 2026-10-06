import React, { useEffect, useMemo, useRef, useState } from 'react';
import MessageItem from './MessageItem';

// Khoá để xác định 2 tin nhắn liên tiếp có cùng người gửi hay không
const getSenderKey = (message) =>
  `${message.senderType}:${message.senderId ?? message.senderName ?? 'unknown'}`;

const getSenderLabel = (message, isOwn) => {
  if (message.senderType === 'Admin') return message.senderName || (isOwn ? 'Bạn' : 'Admin');
  if (message.senderType === 'User') return message.senderName || (isOwn ? 'Bạn' : 'Khách');
  if (message.senderType === 'AI') return message.senderName || 'AI';
  return message.senderType;
};

const QUICK_ACTIONS = [
  { icon: '✦', label: 'SẢN PHẨM NỔI BẬT', text: 'Cho tôi xem sản phẩm nổi bật' },
  { icon: '▣', label: 'ĐƠN HÀNG CỦA TÔI', text: 'Tôi muốn tra cứu đơn hàng của tôi' },
  { icon: '↕', label: 'BẢNG SIZE', text: 'Cho tôi xem bảng size' },
  { icon: '↻', label: 'ĐỔI TRẢ', text: 'Chính sách đổi trả như thế nào?' },
];

export default function MessageList({
  messages,
  currentUserId,
  isAdmin,
  typingUserId,
  welcomeName,
  showWelcome = true,
  onQuickAction,
  adminOffline,
  onSwitchToAI,
  onDismissOfflineNotice,
}) {
  const bottomRef = useRef(null);
  const [welcomeVisible, setWelcomeVisible] = useState(true);
  const [welcomeLeaving, setWelcomeLeaving] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUserId]);

  useEffect(() => {
    if (messages.length === 0 || !welcomeVisible) return undefined;
    setWelcomeLeaving(true);
    const timer = window.setTimeout(() => setWelcomeVisible(false), 200);
    return () => window.clearTimeout(timer);
  }, [messages.length, welcomeVisible]);

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
        result.push({ type: 'system', key: message.id ?? `system-${result.length}`, message });
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
    <div className="chat-message-list" aria-live="polite">
      {showWelcome && welcomeVisible && (
        <div className={`chat-welcome${welcomeLeaving ? ' chat-welcome--leaving' : ''}`}>
          <p className="chat-welcome__greeting">
            Chào {welcomeName?.trim() || 'bạn'}, hôm nay tìm đồ gì nè?
          </p>
          <div className="chat-welcome__actions">
            {QUICK_ACTIONS.map(({ icon, label, text }) => (
              <button key={label} type="button" onClick={() => onQuickAction(text)} aria-label={label}>
                <span aria-hidden="true">{icon}</span>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {groups.map((group) => {
        if (group.type === 'system') {
          return <MessageItem key={group.key} message={group.message} isOwn={false} isFloating={!isAdmin} />;
        }

        return (
          <div
            key={group.key}
            className={`chat-message-group ${group.isOwn ? 'chat-message-group--own' : 'chat-message-group--other'}`}
          >
            {isAdmin && <div className="chat-message-group__sender">{group.senderLabel}</div>}
            {group.items.map((message, index) => (
              <MessageItem
                key={message.id}
                message={message}
                isOwn={group.isOwn}
                showAvatar={!group.isOwn && index === 0}
                avatarLabel={message.senderType === 'AI' ? '✦' : 'T'}
                isFloating={!isAdmin}
              />
            ))}
          </div>
        );
      })}

      {typingUserId && typingUserId !== currentUserId && (
        <div className="chat-typing-indicator" role="status" aria-label="Đang soạn tin">
          {isAdmin ? 'Đang nhập...' : <><span /><span /><span /></>}
        </div>
      )}
      {adminOffline && (
        <div className="chat-offline-note">
          <p>Nhân viên đang offline. Bạn vẫn có thể để lại lời nhắn.</p>
          <div>
            <button type="button" onClick={onSwitchToAI}>Hỏi Trợ lý AI trước</button>
            <button type="button" onClick={onDismissOfflineNotice}>Để lại lời nhắn</button>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}