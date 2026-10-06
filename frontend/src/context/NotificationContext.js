import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { notificationsAPI, blogNotificationsAPI } from '../api/app';

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

  // Database persistent notifications
  const [dbNotifications, setDbNotifications] = useState([]);
  const [dbUnreadCount, setDbUnreadCount] = useState(0);

  // Blog persistent notifications
  const [blogNotifications, setBlogNotifications] = useState([]);
  const [blogUnreadCount, setBlogUnreadCount] = useState(0);

  const fetchDbNotifications = useCallback(async () => {
    const token = localStorage.getItem('thebob-token');
    if (!token) {
      setDbNotifications([]);
      setDbUnreadCount(0);
      setBlogNotifications([]);
      setBlogUnreadCount(0);
      return;
    }
    try {
      const res = await notificationsAPI.getAll();
      if (res && res.success) {
        setDbNotifications(res.data || []);
        const unread = (res.data || []).filter(n => !n.isRead || n.isRead === false).length;
        setDbUnreadCount(unread);
      }
    } catch (err) {
      console.error('Failed to fetch persistent notifications:', err);
    }

    try {
      const blogRes = await blogNotificationsAPI.getMyNotifications();
      const items = blogRes?.data || blogRes || [];
      setBlogNotifications(items);
      setBlogUnreadCount(items.filter(n => !n.isRead).length);
    } catch (err) {
      console.error('Failed to fetch blog notifications:', err);
    }
  }, []);

  const markDbAsRead = useCallback(async (id) => {
    try {
      await notificationsAPI.markAsRead(id);
      setDbNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setDbUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  }, []);

  const markBlogAsRead = useCallback(async (id) => {
    try {
      await blogNotificationsAPI.markAsRead(id);
      setBlogNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setBlogUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark blog notification as read:', err);
    }
  }, []);

  const markAllDbAsRead = useCallback(async () => {
    try {
      await notificationsAPI.markAllAsRead();
      setDbNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setDbUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  }, []);

  // Fetch notifications on mount if token exists
  useEffect(() => {
    fetchDbNotifications();
  }, [fetchDbNotifications]);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);

  const addNotification = useCallback((message, type = 'info', duration = 5000) => {
    const id = Date.now() + Math.random();
    const notification = { id, message, type };

    setNotifications(prev => [...prev, notification]);

    if (duration > 0) {
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }, duration);
    }

    return id;
  }, []);

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

  const value = useMemo(() => ({
    notifications,
    addNotification,
    removeNotification,
    clearAllNotifications,
    unreadCount,
    incrementUnread,
    resetUnread,

    // Expose persistent notifications
    dbNotifications,
    dbUnreadCount,
    blogNotifications,
    blogUnreadCount,
    fetchDbNotifications,
    markDbAsRead,
    markBlogAsRead,
    markAllDbAsRead
  }), [
    notifications,
    addNotification,
    removeNotification,
    clearAllNotifications,
    unreadCount,
    incrementUnread,
    resetUnread,

    dbNotifications,
    dbUnreadCount,
    blogNotifications,
    blogUnreadCount,
    fetchDbNotifications,
    markDbAsRead,
    markBlogAsRead,
    markAllDbAsRead
  ]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};