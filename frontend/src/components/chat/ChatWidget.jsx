import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { chatAPI } from '../../api/app';
import ChatWindow from './ChatWindow';
import '../../styles/Chat.css';

const unwrap = (res) => res?.data ?? res;
const SPEECH_CHARACTERS = ['A', 'B', 'C', 'ơ', 'ê', '?', '!', '…', 'Bla', 'Hả', 'Ê'];

export default function ChatWidget() {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [chatMode, setChatMode] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [currentProductId, setCurrentProductId] = useState(null);
  const [isAdminOnline, setIsAdminOnline] = useState(false);
  const [speechCharacters, setSpeechCharacters] = useState([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isHoveringToggle, setIsHoveringToggle] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const nextCharacterId = useRef(0);
  const previousCharacter = useRef(null);
  const timers = useRef(new Set());
  const speechCharactersRef = useRef([]);
  const closeTimer = useRef(null);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  const updateSpeechCharacters = useCallback((update) => {
    const nextCharacters = typeof update === 'function'
      ? update(speechCharactersRef.current)
      : update;
    speechCharactersRef.current = nextCharacters;
    setSpeechCharacters(nextCharacters);
  }, []);

  const schedule = useCallback((callback, delay) => {
    let timer;
    timer = window.setTimeout(() => {
      timers.current.delete(timer);
      callback();
    }, delay);
    timers.current.add(timer);
  }, []);

  const clearTimers = useCallback(() => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current.clear();
  }, []);

  const emitCharacter = useCallback(() => {
    const current = speechCharactersRef.current;
    if (current.length >= 12) return;

    const options = SPEECH_CHARACTERS.filter((character) => character !== previousCharacter.current);
    const character = options[Math.floor(Math.random() * options.length)];
    previousCharacter.current = character;

    const angle = (20 + Math.random() * 50) * (Math.PI / 180);
    const distance = window.matchMedia('(max-width: 480px)').matches
      ? 50 + Math.random() * 30
      : 60 + Math.random() * 50;
    const size = 14 + Math.random() * 8;
    const rotation = -25 + Math.random() * 50;
    const darkColor = Math.random() < 0.5;
    const entry = {
      id: nextCharacterId.current++,
      character,
      style: {
        '--speech-x': `${-Math.sin(angle) * distance}px`,
        '--speech-y': `${-Math.cos(angle) * distance}px`,
        '--speech-start-x': `${-Math.sin(angle) * distance * 0.15}px`,
        '--speech-start-y': `${-Math.cos(angle) * distance * 0.15}px`,
        '--speech-rotation': `${rotation}deg`,
        '--speech-start-rotation': `${rotation * 0.15}deg`,
        '--speech-size': `${size}px`,
        '--speech-color': darkColor ? '#111' : '#c8102e',
      },
    };

    updateSpeechCharacters((items) => [...items, entry]);
  }, [updateSpeechCharacters]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);
    updatePreference();
    mediaQuery.addEventListener('change', updatePreference);
    return () => mediaQuery.removeEventListener('change', updatePreference);
  }, []);

  useEffect(() => {
    if (!isAuthenticated() || open || prefersReducedMotion) {
      clearTimers();
      updateSpeechCharacters([]);
      setIsSpeaking(false);
      return undefined;
    }

    let cancelled = false;
    const startAutomaticSpeech = () => {
      if (cancelled) return;
      setIsSpeaking(true);
      schedule(() => setIsSpeaking(false), 2000);
      const count = window.matchMedia('(max-width: 480px)').matches
        ? 4 + Math.floor(Math.random() * 2)
        : 7 + Math.floor(Math.random() * 3);
      for (let index = 0; index < count; index += 1) {
        schedule(emitCharacter, index * 100);
      }
      schedule(startAutomaticSpeech, 12000);
    };

    schedule(startAutomaticSpeech, 4000);
    return () => {
      cancelled = true;
      clearTimers();
      speechCharactersRef.current = [];
    };
  }, [clearTimers, emitCharacter, isAuthenticated, open, prefersReducedMotion, schedule, updateSpeechCharacters]);

  useEffect(() => {
    if (!isHoveringToggle || open || prefersReducedMotion) return undefined;
    const interval = window.setInterval(emitCharacter, 250);
    return () => window.clearInterval(interval);
  }, [emitCharacter, isHoveringToggle, open, prefersReducedMotion]);

  const handleCharacterAnimationEnd = (id) => {
    updateSpeechCharacters((items) => items.filter((item) => item.id !== id));
  };

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

  useEffect(() => {
    if (!isAuthenticated()) return;

    chatAPI.getAdminStatus()
      .then((res) => setIsAdminOnline(unwrap(res) === true))
      .catch((error) => console.error('Failed to load support status:', error));
  }, [isAuthenticated]);

  useEffect(() => {
    if (!open || chatMode) return undefined;
    const handleEscape = (event) => {
      if (event.key !== 'Escape') return;
      window.clearTimeout(closeTimer.current);
      setIsClosing(true);
      closeTimer.current = window.setTimeout(() => {
        setOpen(false);
        setIsClosing(false);
      }, 220);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, chatMode]);

  if (!isAuthenticated()) return null;

  const handleClose = () => {
    window.clearTimeout(closeTimer.current);
    setIsClosing(true);
    closeTimer.current = window.setTimeout(() => {
      setOpen(false);
      setChatMode(null);
      setIsClosing(false);
    }, 220);
  };

  const handleModeSelect = (mode) => {
    window.clearTimeout(closeTimer.current);
    setIsClosing(false);
    setOpen(true);
    const conversation = conversations.find(
      (item) => item.status === 'Open' && item.chatMode?.toLowerCase() === mode.toLowerCase()
    );
    setConversationId(conversation?.id ?? null);
    setChatMode(mode);
  };

  const handleSwitchToAI = () => {
    const conversation = conversations.find(
      (item) => item.status === 'Open' && item.chatMode?.toLowerCase() === 'ai'
    );
    setConversationId(conversation?.id ?? null);
    setChatMode('AI');
  };

  return (
    <div className="chat-widget">
      {(open || isClosing) && !chatMode && (
        <div className={`chat-mode-picker chat-mode-picker--floating${isClosing ? ' chat-panel--closing' : ''}`} role="dialog" aria-modal="true" aria-label="Hỗ trợ khách hàng">
          <button type="button" className="chat-mode-picker__close" onClick={handleClose} aria-label="Đóng cửa sổ hỗ trợ">
            ×
          </button>
          <div className="chat-mode-picker__eyebrow">THEBOB hỗ trợ</div>
          <h3>Bạn muốn trò chuyện với ai?</h3>
          <button
            type="button"
            className="chat-mode-picker__option"
            onClick={() => handleModeSelect('AI')}
            aria-label="Trò chuyện với trợ lý AI"
          >
            <span className="chat-mode-picker__icon" aria-hidden="true">✦</span>
            <span><strong>TRỢ LÝ AI</strong><small>Trả lời ngay, 24/7</small></span>
            <span className="chat-mode-picker__arrow" aria-hidden="true">→</span>
          </button>
          <button
            type="button"
            className="chat-mode-picker__option"
            onClick={() => handleModeSelect('Admin')}
            aria-label="Trò chuyện với nhân viên hỗ trợ"
          >
            <span className="chat-mode-picker__icon" aria-hidden="true">✦</span>
            <span>
              <strong>NHÂN VIÊN HỖ TRỢ</strong>
              <small>
                {!isAdminOnline && <span className="chat-mode-picker__offline-dot" aria-hidden="true" />}
                {isAdminOnline ? 'Thường trả lời trong vài phút' : 'Đang offline, để lại lời nhắn'}
              </small>
            </span>
            <span className="chat-mode-picker__arrow" aria-hidden="true">→</span>
          </button>
          <p className="chat-mode-picker__note">Bạn có thể đổi người hỗ trợ bất cứ lúc nào.</p>
        </div>
      )}
      {(open || isClosing) && chatMode && (
        <ChatWindow
          conversationId={conversationId}
          onConversationChange={(id) => {
            setConversationId(id);
            setConversations((previous) => previous.some((item) => item.id === id)
              ? previous
              : [...previous, { id, status: 'Open', chatMode }]);
          }}
          currentUserId={user?.id}
          currentUserName={user?.name || user?.fullName || user?.username || user?.userName}
          isAdmin={false}
          chatMode={chatMode}
          title={chatMode === 'AI' ? 'Trợ lý AI THEBOB' : 'Nhân viên hỗ trợ'}
          onClose={handleClose}
          isClosing={isClosing}
          onBack={() => setChatMode(null)}
          onSwitchToAI={handleSwitchToAI}
          isAdminOnline={isAdminOnline}
          onAdminStatusChange={setIsAdminOnline}
          productId={currentProductId}
        />
      )}
      <button
        type="button"
        className={`chat-widget__toggle${isSpeaking && !open && !prefersReducedMotion ? ' chat-widget__toggle--speaking' : ''}${isHoveringToggle && !open && !prefersReducedMotion ? ' chat-widget__toggle--hovering' : ''}`}
        onClick={() => {
          if (open) {
            handleClose();
          } else {
            window.clearTimeout(closeTimer.current);
            setIsClosing(false);
            setOpen(true);
          }
        }}
        onMouseEnter={() => setIsHoveringToggle(true)}
        onMouseLeave={() => setIsHoveringToggle(false)}
        aria-label={open ? 'Đóng chat' : 'Mở chat'}
      >
        {open ? '✕' : '🗣'}
      </button>
      {!open && !prefersReducedMotion && (
        <span className="chat-widget__speech-layer" aria-hidden="true">
          {speechCharacters.map(({ id, character, style }) => (
            <span
              key={id}
              className="chat-widget__speech-character"
              style={style}
              onAnimationEnd={() => handleCharacterAnimationEnd(id)}
            >
              {character}
            </span>
          ))}
        </span>
      )}
    </div>
  );
}
