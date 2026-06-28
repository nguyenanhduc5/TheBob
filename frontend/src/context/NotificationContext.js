import { createContext, useContext, useState, useCallback, useMemo } from 'react';

const NotificationContext = createContext();

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(() => {
    const saved = localStorage.getItem('thebob-unread-count');
    return saved ? parseInt(saved, 10) : 0;
  });

  // ✅ FIX: useCallback với deps rỗng → addNotification có stable reference
  // Trước đây: function thường → tạo reference mới mỗi render
  // → mọi component dùng addNotification trong useCallback/useEffect deps đều re-run liên tục
  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);

  const addNotification = useCallback((message, type = 'info', duration = 5000) => {
    const id = Date.now();
    const notification = { id, message, type };

    setNotifications(prev => [...prev, notification]);

    if (duration > 0) {
      setTimeout(() => {
        // Dùng functional form setNotifications thay vì gọi removeNotification
        // để tránh closure stale
        setNotifications(prev => prev.filter(n => n.id !== id));
      }, duration);
    }

    return id;
  }, []); // stable reference — không bao giờ thay đổi

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const incrementUnread = useCallback(() => {
    setUnreadCount(prev => {
      const next = prev + 1;
      localStorage.setItem('thebob-unread-count', next);
      return next;
    });
  }, []);

  const resetUnread = useCallback(() => {
    setUnreadCount(0);
    localStorage.setItem('thebob-unread-count', 0);
  }, []);

  // ✅ FIX: useMemo cho value object → không tạo object mới mỗi render
  // Trước đây: value = { ... } inline → object mới mỗi render
  // → tất cả consumer (useNotification) re-render theo dù data không đổi
  const value = useMemo(() => ({
    notifications,
    addNotification,
    removeNotification,
    clearAllNotifications,
    unreadCount,
    incrementUnread,
    resetUnread,
  }), [
    notifications,
    addNotification,
    removeNotification,
    clearAllNotifications,
    unreadCount,
    incrementUnread,
    resetUnread,
  ]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};