import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';

const CartContext = createContext();

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export const CartProvider = ({ children }) => {
  const { user } = useAuth();
  const [cartData, setCartData] = useState({ userId: null, items: [] });

  // Load cart từ localStorage khi user thay đổi
  useEffect(() => {
    if (!user) {
      setCartData({ userId: 'guest', items: [] });
    } else {
      const userId = user.id || user.email;
      const key = `thebob-cart-${userId}`;
      const savedCart = localStorage.getItem(key);
      const items = savedCart ? JSON.parse(savedCart) : [];
      setCartData({ userId, items });
    }
  }, [user]);

  // Lưu cart vào localStorage khi cartData thay đổi
  useEffect(() => {
    const currentUserId = user ? (user.id || user.email) : 'guest';
    if (cartData.userId === currentUserId) {
      const key = user ? `thebob-cart-${user.id || user.email}` : 'thebob-cart';
      localStorage.setItem(key, JSON.stringify(cartData.items));
    }
  }, [cartData, user]);

  const getItemKey = useCallback((item) => item.variantId ?? item.id, []);

  // ✅ FIX: useCallback cho tất cả functions để stable reference
  const addToCart = useCallback((product, quantity = 1) => {
    setCartData(prev => {
      const productKey = product.variantId ?? product.id;
      const existing = prev.items.find(item => (item.variantId ?? item.id) === productKey);
      let newItems;
      if (existing) {
        newItems = prev.items.map(item =>
          (item.variantId ?? item.id) === productKey
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      } else {
        newItems = [...prev.items, { ...product, quantity }];
      }
      return { ...prev, items: newItems };
    });
  }, []);

  const removeFromCart = useCallback((itemKey) => {
    setCartData(prev => ({
      ...prev,
      items: prev.items.filter(item => (item.variantId ?? item.id) !== itemKey)
    }));
  }, []);

  const updateQuantity = useCallback((itemKey, quantity) => {
    if (quantity <= 0) {
      setCartData(prev => ({
        ...prev,
        items: prev.items.filter(item => (item.variantId ?? item.id) !== itemKey)
      }));
      return;
    }
    setCartData(prev => ({
      ...prev,
      items: prev.items.map(item =>
        (item.variantId ?? item.id) === itemKey ? { ...item, quantity } : item
      )
    }));
  }, []);

  const clearCart = useCallback(() => {
    setCartData(prev => ({ ...prev, items: [] }));
  }, []);

  const getTotalItems = useCallback(() => {
    return cartData.items.reduce((total, item) => total + item.quantity, 0);
  }, [cartData.items]);

  const getTotalPrice = useCallback(() => {
    return cartData.items.reduce((total, item) => total + (item.price * item.quantity), 0);
  }, [cartData.items]);

  // ✅ FIX: useMemo cho value → không tạo object mới mỗi render
  const value = useMemo(() => ({
    cartItems: cartData.items,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getTotalItems,
    getTotalPrice,
  }), [cartData.items, addToCart, removeFromCart, updateQuantity, clearCart, getTotalItems, getTotalPrice]);

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};