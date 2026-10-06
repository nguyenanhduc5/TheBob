import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import { chatAPI, CHAT_HUB_URL } from '../../api/app';
import MessageList from './MessageList';
import ProductContextCard from './ProductContextCard';
import SuggestedQuestions from './SuggestedQuestions';
import SendVoucherModal from './SendVoucherModal';
import AttachBlogModal from '../blog/AttachBlogModal';
import { createTypingNotifier } from './typingNotifier';
import '../../styles/Chat.css';

const unwrap = (res) => res?.data ?? res;

export default function ChatWindow({
  conversationId,
  onConversationChange,
  currentUserId,
  currentUserName,
  targetUserId,
  targetUserName,
  isAdmin = false,
  chatMode,
  title = 'Hỗ trợ trực tuyến',
  onClose,
  onBack,
  isClosing = false,
  onSwitchToAI,
  isAdminOnline: adminOnlineFromParent,
  onAdminStatusChange,
  productId,
}) {
  const [activeConversationId, setActiveConversationId] = useState(conversationId ?? null);
  const [activeProductId, setActiveProductId] = useState(productId ?? null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [typingUserId, setTypingUserId] = useState(null);
  const [connected, setConnected] = useState(false);
  const [hasConnected, setHasConnected] = useState(false);
  const [connectionAttemptFailed, setConnectionAttemptFailed] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isAdminOnline, setIsAdminOnline] = useState(adminOnlineFromParent ?? false);
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [showBlogModal, setShowBlogModal] = useState(false);
  const [showUtilityMenu, setShowUtilityMenu] = useState(false);
  const [showProductTools, setShowProductTools] = useState(false);
  const [offlineNoticeDismissed, setOfflineNoticeDismissed] = useState(false);
  const connectionRef = useRef(null);
  const typingNotifierRef = useRef(null);
  const inputRef = useRef(null);
  const utilityMenuRef = useRef(null);
  const seenSentRef = useRef(false);
  const activeConversationIdRef = useRef(activeConversationId);

  const token = localStorage.getItem('thebob-token');

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    setIsAdminOnline(adminOnlineFromParent ?? false);
  }, [adminOnlineFromParent]);

  useEffect(() => {
    if (!isAdmin) {
      chatAPI.getAdminStatus()
        .then((res) => {
          const isOnline = unwrap(res) === true;
          setIsAdminOnline(isOnline);
          onAdminStatusChange?.(isOnline);
        })
        .catch((error) => console.error('Failed to load support status:', error));
    }
  }, [isAdmin, onAdminStatusChange]);

  useEffect(() => {
    if (!isAdmin) inputRef.current?.focus();
  }, [isAdmin]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (showUtilityMenu && utilityMenuRef.current && !utilityMenuRef.current.contains(event.target)) {
        setShowUtilityMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showUtilityMenu]);

  const updateConversationId = useCallback((id) => {
    setActiveConversationId(id);
    onConversationChange?.(id);
  }, [onConversationChange]);

  const loadMessages = useCallback(async (convId) => {
    if (!convId) return;
    setLoading(true);
    try {
      const res = unwrap(await chatAPI.getMessages(convId, 1, 10));
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

  // 1. Quản lý kết nối SignalR Hub: duy trì kết nối xuyên suốt khi có token
  useEffect(() => {
    if (!token) return undefined;

    const conn = new signalR.HubConnectionBuilder()
      .withUrl(CHAT_HUB_URL, { accessTokenFactory: () => token })
      .withAutomaticReconnect([0, 2000, 5000, 10000])
      .build();

    connectionRef.current = conn;

    conn.on('ReceiveMessage', (message) => {
      // Chỉ nhận tin thuộc conversation hiện tại (so sánh bằng Number)
      if (Number(message.conversationId) !== Number(activeConversationIdRef.current)) return;
      setMessages((prev) => {
        // Nếu có tin tạm cùng senderType và nội dung khớp -> thế chỗ bằng tin thật từ server
        const senderMatch = message.senderType === (isAdmin ? 'Admin' : 'User');
        if (senderMatch) {
          const tempIdx = prev.findIndex((m) => (m.isSending || String(m.id).startsWith('temp-')) && m.content === message.content);
          if (tempIdx !== -1) {
            const next = [...prev];
            next[tempIdx] = message;
            return next;
          }
        }
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
    });

    conn.on('TypingIndicator', (convId, userId, isTyping) => {
      if (Number(convId) !== Number(activeConversationIdRef.current)) return;
      setTypingUserId(isTyping ? userId : null);
    });

    conn.on('MessagesSeen', (convId) => {
      if (Number(convId) !== Number(activeConversationIdRef.current)) return;
      setMessages((prev) => prev.map((m) => {
        const fromOther = isAdmin ? m.senderType === 'User' : m.senderType === 'Admin';
        return fromOther ? { ...m, isRead: true } : m;
      }));
    });

    conn.on('AdminStatusChanged', (isOnline) => {
      if (!isAdmin) {
        setIsAdminOnline(isOnline);
        onAdminStatusChange?.(isOnline);
      }
    });

    conn.onreconnected(() => {
      setConnected(true);
      setHasConnected(true);
      setConnectionAttemptFailed(false);
      setIsReconnecting(false);
      if (activeConversationIdRef.current) {
        conn.invoke('JoinConversation', Number(activeConversationIdRef.current)).catch(() => {});
      }
    });

    conn.onclose(() => {
      setConnected(false);
      setConnectionAttemptFailed(true);
      setIsReconnecting(false);
    });

    conn.onreconnecting(() => {
      setIsReconnecting(true);
    });

    conn.start()
      .then(() => {
        setConnected(true);
        setHasConnected(true);
        setConnectionAttemptFailed(false);
        setIsReconnecting(false);
      })
      .catch((err) => {
        console.error('Chat SignalR start failed:', err);
        setConnected(false);
        setConnectionAttemptFailed(true);
      });

    return () => {
      conn.stop().catch(() => {});
      connectionRef.current = null;
      setConnected(false);
    };
  }, [token, isAdmin, onAdminStatusChange]);

  // 2. Tham gia phòng chat khi activeConversationId thay đổi và đã kết nối
  useEffect(() => {
    const conn = connectionRef.current;
    if (!conn || !connected || !activeConversationId) return undefined;

    const convId = Number(activeConversationId);
    conn.invoke('JoinConversation', convId).catch((err) => {
      console.warn('JoinConversation failed:', err);
    });

    if (!seenSentRef.current) {
      seenSentRef.current = true;
      conn.invoke('Seen', convId).catch(() => {});
    }

    return () => {
      conn.invoke('LeaveConversation', convId).catch(() => {});
    };
  }, [activeConversationId, connected]);

  useEffect(() => {
    const conn = connectionRef.current;
    if (!conn || !connected || !activeConversationId) return undefined;
    const notifier = createTypingNotifier((isTyping) => {
      if (conn.state === signalR.HubConnectionState.Connected) {
        conn.invoke('Typing', Number(activeConversationId), isTyping).catch(() => {});
      }
    });
    typingNotifierRef.current = notifier;
    return () => {
      notifier.stop();
      typingNotifierRef.current = null;
    };
  }, [activeConversationId, connected]);

  const handleTyping = useCallback((value) => {
    setInput(value);
    typingNotifierRef.current?.update(value);
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 104)}px`;
    }
  }, []);

  const getSafeProductId = () => {
    if (!activeProductId) return null;
    const parsed = parseInt(activeProductId, 10);
    return isNaN(parsed) ? null : parsed;
  };

  const handleSend = async (e, textOverride = null) => {
    if (e) e.preventDefault();
    const text = (textOverride || input).trim();
    if (!text) return;
    typingNotifierRef.current?.stop();

    if (!textOverride) handleTyping('');

    const safeProductId = getSafeProductId();
    const tempId = `temp-${Date.now()}`;
    const tempMessage = {
      id: tempId,
      content: text,
      senderType: isAdmin ? 'Admin' : 'User',
      senderId: currentUserId,
      createdAt: new Date().toISOString(),
      isSending: false, // Optimistic UI: hiển thị tức thì
    };

    setMessages((prev) => [...prev, tempMessage]);

    const conn = connectionRef.current;
    if (activeConversationId && conn && conn.state === signalR.HubConnectionState.Connected) {
      try {
        const res = await conn.invoke('SendMessage', Number(activeConversationId), text, safeProductId, null, chatMode);
        if (res) {
          setMessages((prev) => prev.map((m) => (m.id === tempId ? res : m)));
        }
      } catch (err) {
        console.warn('SignalR SendMessage failed, trying REST API fallback:', err);
        try {
          const res = unwrap(await chatAPI.sendMessage(text, Number(activeConversationId), safeProductId, chatMode));
          if (res) {
            setMessages((prev) => prev.map((m) => (m.id === tempId ? res : m)));
          }
        } catch (restErr) {
          console.error('Send message failed completely:', restErr);
          setMessages((prev) => prev.filter((m) => m.id !== tempId));
          if (!textOverride) setInput(text);
        }
      }
    } else {
      // Tin nhắn đầu tiên (chưa có activeConversationId) hoặc SignalR chưa sẵn sàng
      try {
        const convIdParam = activeConversationId ? Number(activeConversationId) : undefined;
        const res = unwrap(await chatAPI.sendMessage(text, convIdParam, safeProductId, chatMode));
        if (!activeConversationId && res?.conversationId) {
          updateConversationId(res.conversationId);
        }
        if (res) {
          setMessages((prev) => prev.map((m) => (m.id === tempId ? res : m)));
        }
      } catch (err) {
        console.error('Send message via REST failed:', err);
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        if (!textOverride) setInput(text);
      }
    }
  };

  return (
    <div
      className={`chat-window${!isAdmin ? ' chat-window--floating' : ''}${isClosing ? ' chat-panel--closing' : ''}`}
      role={!isAdmin ? 'dialog' : undefined}
      aria-modal={!isAdmin ? 'true' : undefined}
      aria-label={!isAdmin ? 'Hỗ trợ khách hàng' : undefined}
    >
      {isAdmin ? (
        <div className="chat-window__header">
          <div>
            <h3>{title}</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
          </div>
        </div>
      ) : (
      <div className="chat-window__header">
        <div className="chat-window__identity">
          {onBack && (
            <button type="button" className="chat-window__back" onClick={onBack} aria-label="Quay lại chọn hỗ trợ">
              ←
            </button>
          )}
          <span className="chat-window__avatar" aria-hidden="true">{chatMode === 'AI' ? '✦' : 'T'}</span>
          <div className="chat-window__identity-copy">
            <h3>{chatMode === 'AI' ? 'TRỢ LÝ AI THEBOB' : 'NHÂN VIÊN THEBOB'}</h3>
            <span className={`chat-window__status ${chatMode === 'AI' || isAdminOnline ? 'online' : 'offline'}`}>
              {chatMode === 'AI'
                ? 'Trợ lý sẵn sàng'
                : isAdminOnline ? 'Đang hoạt động' : 'Offline, sẽ trả lời khi online'}
            </span>
          </div>
        </div>
        <div className="chat-window__header-actions">
          {onClose && (
            <button type="button" className="chat-window__close" onClick={onClose} aria-label="Đóng chat">
              ×
            </button>
          )}
        </div>
      </div>
      )}

      {!isAdmin && (isReconnecting || (hasConnected && !connected) || connectionAttemptFailed) && (
        <div className="chat-window__connection-warning" role="status">
          {isReconnecting
            ? 'Mất kết nối, đang thử lại...'
            : hasConnected ? 'Mất kết nối.' : 'Không thể kết nối chat.'}
        </div>
      )}

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

      {!isAdmin && showProductTools && (
        <div className="chat-window__product-tools">
          <ProductContextCard
            productId={activeProductId}
            onSelectProduct={(id) => setActiveProductId(id)}
            onClearProduct={() => setActiveProductId(null)}
            onSendOrderMessage={(text) => handleSend(null, text)}
          />
        </div>
      )}

      {loading ? (
        <div className="chat-window__loading">Đang tải tin nhắn...</div>
      ) : (
        <MessageList
          messages={messages}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          typingUserId={typingUserId}
          welcomeName={currentUserName}
          showWelcome={!isAdmin}
          onQuickAction={(text) => handleSend(null, text)}
          adminOffline={chatMode === 'Admin' && !isAdminOnline && !offlineNoticeDismissed}
          onSwitchToAI={onSwitchToAI}
          onDismissOfflineNotice={() => {
            setOfflineNoticeDismissed(true);
            inputRef.current?.focus();
          }}
        />
      )}

      {!isAdmin && (
        <SuggestedQuestions onSelect={(question) => handleSend(null, question)} />
      )}

      {isAdmin ? (
      <form className="chat-window__input-row" onSubmit={handleSend}>
        <input
          type="text"
          value={input}
          onChange={(event) => handleTyping(event.target.value)}
          placeholder="Nhập tin nhắn..."
        />
        <button type="submit" disabled={!input.trim()}>Gửi</button>
      </form>
      ) : (
      <form className="chat-window__input-row" onSubmit={handleSend}>
        <div className="chat-window__utility" ref={utilityMenuRef}>
          <button
            type="button"
            className="chat-window__utility-toggle"
            onClick={() => setShowUtilityMenu((visible) => !visible)}
            aria-label="Mở công cụ chat"
            aria-expanded={showUtilityMenu}
          >
            +
          </button>
          {showUtilityMenu && (
            <div className="chat-window__utility-menu">
              <button
                type="button"
                onClick={() => {
                  setShowProductTools((visible) => !visible);
                  setShowUtilityMenu(false);
                }}
              >
                Tìm sản phẩm
              </button>
              <button
                type="button"
                disabled
                title="Tính năng gửi ảnh chưa được hỗ trợ bởi API chat hiện tại"
                aria-label="Gửi ảnh, hiện chưa được hỗ trợ"
              >
                Gửi ảnh
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowProductTools(true);
                  setShowUtilityMenu(false);
                  handleSend(null, 'Tôi muốn tra cứu đơn hàng của tôi');
                }}
              >
                Tra cứu đơn hàng
              </button>
            </div>
          )}
        </div>
        <textarea
          ref={inputRef}
          value={input}
          rows={1}
          onChange={(event) => handleTyping(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              handleSend(event);
            }
          }}
          placeholder="Nhập tin nhắn..."
          aria-label="Nhập tin nhắn"
        />
        <button type="submit" disabled={!input.trim()} aria-label="Gửi tin nhắn">
          ↑
        </button>
      </form>
      )}
    </div>
  );
}
