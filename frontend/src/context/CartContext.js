import { createContext, useContext, useState, useEffect } from 'react';
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

  // When user changes, load their cart from local storage. If they logged out (user is null), reset cart to empty array.
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

  // Save cart to local storage when cartData changes, but only if it matches current user
  useEffect(() => {
    const currentUserId = user ? (user.id || user.email) : 'guest';
    if (cartData.userId === currentUserId) {
      const key = user ? `thebob-cart-${user.id || user.email}` : 'thebob-cart';
      localStorage.setItem(key, JSON.stringify(cartData.items));
    }
  }, [cartData, user]);

  const getItemKey = (item) => item.variantId ?? item.id;

  const addToCart = (product, quantity = 1) => {
    setCartData(prev => {
      const productKey = getItemKey(product);
      const existing = prev.items.find(item => getItemKey(item) === productKey);
      let newItems;
      if (existing) {
        newItems = prev.items.map(item =>
          getItemKey(item) === productKey
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      } else {
        newItems = [...prev.items, { ...product, quantity }];
      }
      return { ...prev, items: newItems };
    });
  };

  const removeFromCart = (itemKey) => {
    setCartData(prev => ({
      ...prev,
      items: prev.items.filter(item => getItemKey(item) !== itemKey)
    }));
  };

  const updateQuantity = (itemKey, quantity) => {
    if (quantity <= 0) {
      removeFromCart(itemKey);
      return;
    }
    setCartData(prev => ({
      ...prev,
      items: prev.items.map(item =>
        getItemKey(item) === itemKey ? { ...item, quantity } : item
      )
    }));
  };

  const clearCart = () => {
    setCartData(prev => ({ ...prev, items: [] }));
  };

  const getTotalItems = () => {
    return cartData.items.reduce((total, item) => total + item.quantity, 0);
  };

  const getTotalPrice = () => {
    return cartData.items.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const value = {
    cartItems: cartData.items,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getTotalItems,
    getTotalPrice,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};
