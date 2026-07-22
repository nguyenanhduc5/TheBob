import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import { chatAPI, CHAT_HUB_URL } from '../../api/app';
import MessageList from './MessageList';
import ProductContextCard from './ProductContextCard';
import SuggestedQuestions from './SuggestedQuestions';
import SendVoucherModal from './SendVoucherModal';
import AttachBlogModal from '../blog/AttachBlogModal';
import '../../styles/Chat.css';

const unwrap = (res) => res?.data ?? res;

export default function ChatWindow({
  conversationId,
  onConversationChange,
  currentUserId,
  targetUserId,
  targetUserName,
  isAdmin = false,
  title = 'Hỗ trợ trực tuyến',
  onClose,
  productId,
}) {
  const [activeConversationId, setActiveConversationId] = useState(conversationId ?? null);
  const [activeProductId, setActiveProductId] = useState(productId ?? null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [typingUserId, setTypingUserId] = useState(null);
  const [connected, setConnected] = useState(false);
  const [isAdminOnline, setIsAdminOnline] = useState(false);
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [showBlogModal, setShowBlogModal] = useState(false);
  const connectionRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const seenSentRef = useRef(false);
  // Set lưu id các tin nhắn tạm (optimistic) chưa được confirm từ server
  const pendingTempIds = useRef(new Set());

  const token = localStorage.getItem('thebob-token');

  useEffect(() => {
    if (!isAdmin) {
      chatAPI.getAdminStatus()
        .then(res => setIsAdminOnline(unwrap(res) === true))
        .catch(() => {});
    }
  }, [isAdmin]);

  const updateConversationId = useCallback((id) => {
    setActiveConversationId(id);
    onConversationChange?.(id);
  }, [onConversationChange]);

  const loadMessages = useCallback(async (convId) => {
    if (!convId) return;
    setLoading(true);
    try {
      const res = unwrap(await chatAPI.getMessages(convId, 1, 100));
      setMessages(res?.items || []);
    } catch (err) {
      console.error('Load messages failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (conversationId) {
      setActiveConversationId(conversationId);
    }
  }, [conversationId]);

  useEffect(() => {
    setActiveProductId(productId);
  }, [productId]);

  useEffect(() => {
    if (activeConversationId) {
      loadMessages(activeConversationId);
      seenSentRef.current = false;
    } else {
      setMessages([]);
    }
  }, [activeConversationId, loadMessages]);

  useEffect(() => {
    if (!token || !activeConversationId) return undefined;

    const conn = new signalR.HubConnectionBuilder()
      .withUrl(CHAT_HUB_URL, { accessTokenFactory: () => token })
      .withAutomaticReconnect()
      .build();

    connectionRef.current = conn;

    conn.on('ReceiveMessage', (message) => {
      if (message.conversationId !== activeConversationId) return;
      setMessages((prev) => {
        // Nếu có tin tạm (isSending) cùng senderType và nội dung khớp -> thế chỗ
        const senderMatch = message.senderType === (isAdmin ? 'Admin' : 'User');
        if (senderMatch) {
          const tempIdx = prev.findIndex((m) => m.isSending && m.content === message.content);
          if (tempIdx !== -1) {
            // Thế tin tạm bằng tin thật
            const next = [...prev];
            next[tempIdx] = message;
            return next;
          }
        }
        // Không có temp khớp — chỉ thêm nếu chưa có
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
    });

    conn.on('TypingIndicator', (convId, userId, isTyping) => {
      if (convId !== activeConversationId) return;
      setTypingUserId(isTyping ? userId : null);
    });

    conn.on('MessagesSeen', (convId) => {
      if (convId !== activeConversationId) return;
      setMessages((prev) => prev.map((m) => {
        const fromOther = isAdmin ? m.senderType === 'User' : m.senderType === 'Admin';
        return fromOther ? { ...m, isRead: true } : m;
      }));
    });

    conn.on('AdminStatusChanged', (isOnline) => {
      if (!isAdmin) {
        setIsAdminOnline(isOnline);
      }
    });

    const start = async () => {
      try {
        await conn.start();
        await conn.invoke('JoinConversation', activeConversationId);
        setConnected(true);
        if (!seenSentRef.current) {
          seenSentRef.current = true;
          await conn.invoke('Seen', activeConversationId);
        }
      } catch (err) {
        console.error('Chat SignalR failed:', err);
        setConnected(false);
      }
    };

    start();

    return () => {
      conn.invoke('LeaveConversation', activeConversationId).catch(() => {});
      conn.stop().catch(() => {});
      connectionRef.current = null;
      setConnected(false);
    };
  }, [token, activeConversationId, isAdmin]);

  const handleTyping = useCallback((value) => {
    setInput(value);
    const conn = connectionRef.current;
    if (!conn || conn.state !== signalR.HubConnectionState.Connected || !activeConversationId) return;

    conn.invoke('Typing', activeConversationId, true).catch(() => {});

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      conn.invoke('Typing', activeConversationId, false).catch(() => {});
    }, 1200);
  }, [activeConversationId]);

  const handleSend = async (e, textOverride = null) => {
    if (e) e.preventDefault();
    const text = (textOverride || input).trim();
    if (!text) return;

    if (!textOverride) {
      setInput('');
    }

    const tempMessage = {
      id: `temp-${Date.now()}`,
      content: text,
      senderType: isAdmin ? 'Admin' : 'User',
      createdAt: new Date().toISOString(),
      isSending: true,
    };

    setMessages((prev) => [...prev, tempMessage]);

    try {
      const conn = connectionRef.current;
      if (activeConversationId && conn?.state === signalR.HubConnectionState.Connected) {
        // Fire-and-forget to make it instant
        conn.invoke('SendMessage', activeConversationId, text, activeProductId, null).catch((err) => {
          console.error('SignalR SendMessage failed:', err);
          // Rollback on error
          setMessages((prev) => prev.filter((m) => m.id !== tempMessage.id));
          if (!textOverride) {
            setInput(text);
          }
        });
        conn.invoke('Typing', activeConversationId, false).catch(() => {});
      } else {
        const res = unwrap(await chatAPI.sendMessage(text, activeConversationId, activeProductId));
        if (!activeConversationId && res?.conversationId) {
          updateConversationId(res.conversationId);
        }
        if (res) {
          setMessages((prev) => {
            const filtered = prev.filter((m) => m.id !== tempMessage.id);
            if (filtered.some((m) => m.id === res.id)) return filtered;
            return [...filtered, res];
          });
        }
      }
    } catch (err) {
      console.error('Send message failed:', err);
      setMessages((prev) => prev.filter((m) => m.id !== tempMessage.id));
      if (!textOverride) {
        setInput(text);
      }
    }
  };

  return (
    <div className="chat-window">
      <div className="chat-window__header">
        <div>
          <h3>{title}</h3>
          <span className={`chat-window__status ${connected ? 'online' : 'offline'}`}>
            {connected ? 'Đang kết nối' : 'Đang kết nối lại...'}
          </span>
          {!isAdmin && (
            <span className={`chat-window__admin-badge ${isAdminOnline ? 'online' : 'offline'}`}>
              {isAdminOnline ? '🟢 Admin đang online' : '⚪ Admin đang offline'}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isAdmin && (
            <>
              <button
                type="button"
                className="chat-window__voucher-header-btn"
                onClick={() => setShowBlogModal(true)}
                title="Đính kèm bài viết Blog"
              >
                📝 Đính kèm Blog
              </button>
              <button
                type="button"
                className="chat-window__voucher-header-btn"
                onClick={() => setShowVoucherModal(true)}
                title="Tặng Voucher riêng cho khách hàng này"
              >
                🎁 Tặng Voucher
              </button>
            </>
          )}
          {onClose && (
            <button type="button" className="chat-window__close" onClick={onClose} aria-label="Đóng chat">
              ✕
            </button>
          )}
        </div>
      </div>

      {showBlogModal && (
        <AttachBlogModal
          onClose={() => setShowBlogModal(false)}
          onSelect={async (blogPost) => {
            if (!activeConversationId) return;
            try {
              const res = unwrap(await chatAPI.sendBlogPost(activeConversationId, blogPost.id));
              if (res) {
                setMessages((prev) => [...prev, res]);
              }
            } catch (err) {
              console.error('Failed to send blog post in chat:', err);
            }
          }}
        />
      )}

      {showVoucherModal && (
        <SendVoucherModal
          userId={targetUserId}
          userName={targetUserName}
          onClose={() => setShowVoucherModal(false)}
          onSendSuccess={(voucherMsg) => handleSend(null, voucherMsg)}
        />
      )}

      {!isAdmin && (
        <ProductContextCard 
          productId={activeProductId} 
          onSelectProduct={(id) => setActiveProductId(id)}
          onClearProduct={() => setActiveProductId(null)}
          onSendOrderMessage={(text) => handleSend(null, text)}
        />
      )}

      {loading ? (
        <div className="chat-window__loading">Đang tải tin nhắn...</div>
      ) : (
        <MessageList
          messages={messages}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          typingUserId={typingUserId}
        />
      )}

      {!isAdmin && (
        <SuggestedQuestions 
          onSelect={(q) => handleSend(null, q)} 
        />
      )}

      <form className="chat-window__input-row" onSubmit={handleSend}>
        <input
          type="text"
          value={input}
          onChange={(e) => handleTyping(e.target.value)}
          placeholder="Nhập tin nhắn..."
        />
        <button type="submit" disabled={!input.trim()}>
          Gửi
        </button>
      </form>
    </div>
  );
}
