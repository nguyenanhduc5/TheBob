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
  const [conversationId, setConversationId] = useState(null);
  
  const [currentProductId, setCurrentProductId] = useState(null);

  useEffect(() => {
    // Extract productId from /products/123 URL
    const match = location.pathname.match(/\/products\/(\d+)/);
    if (match) {
      setCurrentProductId(parseInt(match[1], 10));
    } else {
      setCurrentProductId(null);
    }
  }, [location.pathname, open]);

  useEffect(() => {
    if (!isAuthenticated()) return;

    chatAPI.getConversations()
      .then((res) => {
        const list = unwrap(res) || [];
        const openConv = list.find((c) => c.status === 'Open');
        if (openConv) setConversationId(openConv.id);
      })
      .catch(() => {});
  }, [isAuthenticated]);

  if (!isAuthenticated()) return null;

  return (
    <div className="chat-widget">
      {open && (
        <ChatWindow
          conversationId={conversationId}
          onConversationChange={setConversationId}
          currentUserId={user?.id}
          isAdmin={false}
          title="Hỗ trợ THEBOB"
          onClose={() => setOpen(false)}
          productId={currentProductId}
        />
      )}
      <button
        type="button"
        className="chat-widget__toggle"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Đóng chat' : 'Mở chat'}
      >
        {open ? '✕' : '💬'}
      </button>
    </div>
  );
}
