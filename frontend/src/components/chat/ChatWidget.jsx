import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { chatAPI } from '../../api/app';
import ChatWindow from './ChatWindow';
import '../../styles/Chat.css';

const unwrap = (res) => res?.data ?? res;

export default function ChatWidget() {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [chatMode, setChatMode] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  
  const [currentProductId, setCurrentProductId] = useState(null);

  useEffect(() => {
    // Extract productId or slug from /product/xxx or /products/xxx URL
    const match = location.pathname.match(/\/(?:product|products)\/([^\/]+)/);
    if (match) {
      const param = match[1];
      setCurrentProductId(param);
    } else {
      setCurrentProductId(null);
    }
  }, [location.pathname, open]);

  useEffect(() => {
    if (!isAuthenticated()) return;

    chatAPI.getConversations()
      .then((res) => {
        const list = unwrap(res) || [];
        setConversations(list);
      })
      .catch(() => {});
  }, [isAuthenticated]);

  if (!isAuthenticated()) return null;

  const handleModeSelect = (mode) => {
    const conversation = conversations.find(
      (item) => item.status === 'Open' && item.chatMode?.toLowerCase() === mode.toLowerCase()
    );
    setConversationId(conversation?.id ?? null);
    setChatMode(mode);
  };

  const handleClose = () => {
    setOpen(false);
    setChatMode(null);
  };

  return (
    <div className="chat-widget">
      {open && !chatMode && (
        <div className="chat-mode-picker">
          <div className="chat-mode-picker__eyebrow">THEBOB hỗ trợ</div>
          <h3>Bạn muốn trò chuyện với ai?</h3>
          <button type="button" onClick={() => handleModeSelect('AI')}>
            <span className="chat-mode-picker__icon">✦</span>
            <span><strong>Trợ lý AI</strong><small>Trả lời nhanh mọi lúc</small></span>
          </button>
          <button type="button" onClick={() => handleModeSelect('Admin')}>
            <span className="chat-mode-picker__icon">♙</span>
            <span><strong>Nhân viên hỗ trợ</strong><small>Trao đổi trực tiếp với Admin</small></span>
          </button>
        </div>
      )}
      {open && chatMode && (
        <ChatWindow
          conversationId={conversationId}
          onConversationChange={(id) => {
            setConversationId(id);
            setConversations((previous) => previous.some((item) => item.id === id)
              ? previous
              : [...previous, { id, status: 'Open', chatMode }]);
          }}
          currentUserId={user?.id}
          isAdmin={false}
          chatMode={chatMode}
          title={chatMode === 'AI' ? 'Trợ lý AI THEBOB' : 'Nhân viên hỗ trợ'}
          onClose={handleClose}
          productId={currentProductId}
        />
      )}
      <button
        type="button"
        className="chat-widget__toggle"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Đóng chat' : 'Mở chat'}
      >
        {open ? '✕' : '🗣'}
      </button>
    </div>
  );
}
