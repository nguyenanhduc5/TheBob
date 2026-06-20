import { createContext, useContext, useState } from 'react';

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

  const addNotification = (message, type = 'info', duration = 5000) => {
    const id = Date.now();
    const notification = { id, message, type };

    setNotifications(prev => [...prev, notification]);

    if (duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, duration);
    }

    return id;
  };

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  const incrementUnread = () => {
    setUnreadCount(prev => {
      const next = prev + 1;
      localStorage.setItem('thebob-unread-count', next);
      return next;
    });
  };

  const resetUnread = () => {
    setUnreadCount(0);
    localStorage.setItem('thebob-unread-count', 0);
  };

  const value = {
    notifications,
    addNotification,
    removeNotification,
    clearAllNotifications,
    unreadCount,
    incrementUnread,
    resetUnread,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
