import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { chatAPI } from '../api/app';
import ConversationList from '../components/chat/ConversationList';
import ChatWindow from '../components/chat/ChatWindow';
import '../styles/Chat.css';

const unwrap = (res) => res?.data ?? res;

export default function AdminChat() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const res = unwrap(await chatAPI.getConversations());
      setConversations(res || []);
    } catch (err) {
      console.error('Load conversations failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
    const interval = setInterval(loadConversations, 30000);
    return () => clearInterval(interval);
  }, [loadConversations]);

  const handleSelect = (conv) => {
    setSelected(conv);
    setConversations((prev) =>
      prev.map((c) => (c.id === conv.id ? { ...c, unreadCount: 0 } : c))
    );
  };

  return (
    <div className="admin-chat-page">
      <div className="admin-chat-page__header">
        <h1>💬 Hỗ trợ khách hàng</h1>
        <button type="button" onClick={loadConversations} disabled={loading}>
          Làm mới
        </button>
      </div>

      <div className="admin-chat-layout">
        <aside className="admin-chat-sidebar">
          {loading ? (
            <div className="conversation-list--empty">Đang tải...</div>
          ) : (
            <ConversationList
              conversations={conversations}
              selectedId={selected?.id}
              onSelect={handleSelect}
            />
          )}
        </aside>

        <section className="admin-chat-main">
          {selected ? (
            <ChatWindow
              key={selected.id}
              conversationId={selected.id}
              currentUserId={user?.id}
              targetUserId={selected.userId}
              targetUserName={selected.userName || selected.userEmail || `Khách #${selected.userId}`}
              isAdmin
              title={selected.userName || selected.userEmail || `Khách #${selected.userId}`}
            />
          ) : (
            <div className="admin-chat-placeholder">
              Chọn một hội thoại để bắt đầu trả lời khách hàng.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
