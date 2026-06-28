import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useNotification } from './NotificationContext';
import { cartAPI } from '../api/app';

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
  const { addNotification } = useNotification();
  const [cartData, setCartData] = useState({ userId: null, items: [] });
  const isSyncingGuestCartRef = useRef(false);

  const mapBackendCartToFrontend = (backendCart) => {
    if (!backendCart || !backendCart.cartItems) return [];
    return backendCart.cartItems.map(item => {
      const variant = item.variant || {};
      const product = variant.product || {};
      const size = variant.size || {};
      const color = variant.color || {};
      
      return {
        id: item.id, // ID of cart item in DB
        variantId: item.variantId,
        productId: product.id,
        name: product.name || 'Sản phẩm',
        sku: variant.sku || '',
        mainImageUrl: product.mainImageUrl || '',
        price: variant.price || 0,
        stock: variant.stock || 0,
        selectedSize: size.name || '',
        selectedColor: color.name || '',
        quantity: item.quantity
      };
    });
  };

  const loadDbCart = useCallback(async () => {
    if (!user) return;
    try {
      const backendCart = await cartAPI.getCart();
      const items = mapBackendCartToFrontend(backendCart);
      const userId = user.id || user.email;
      setCartData({ userId, items });
    } catch (err) {
      console.error('Failed to load cart from DB:', err);
    }
  }, [user]);

  // Sync / Load cart when user logs in/out
  useEffect(() => {
    if (!user) {
      setCartData({ userId: 'guest', items: [] });
      return;
    }

    let cancelled = false;

    const initCart = async () => {
      if (isSyncingGuestCartRef.current) return;
      isSyncingGuestCartRef.current = true;

      try {
        const guestSaved = localStorage.getItem('thebob-cart');
        const guestItems = guestSaved ? JSON.parse(guestSaved) : [];
        if (guestItems.length > 0) {
          await cartAPI.syncCart(
            guestItems.map(item => ({ variantId: item.variantId, quantity: item.quantity }))
          );
          localStorage.removeItem('thebob-cart');
        }
      } catch (err) {
        console.error('Failed to sync guest cart to DB:', err);
      } finally {
        isSyncingGuestCartRef.current = false;
      }

      if (!cancelled) {
        await loadDbCart();
      }
    };

    initCart();

    return () => {
      cancelled = true;
    };
  }, [user, loadDbCart]);

  // Save cart to local storage when cartData changes (mainly for guest caching)
  useEffect(() => {
    const currentUserId = user ? (user.id || user.email) : 'guest';
    if (cartData.userId === currentUserId) {
      const key = user ? `thebob-cart-${user.id || user.email}` : 'thebob-cart';
      localStorage.setItem(key, JSON.stringify(cartData.items));
    }
  }, [cartData, user]);

  const getItemKey = (item) => item.variantId ?? item.id;

  // ✅ THAY VÀO
const addToCart = (product, quantity = 1) => {
  const stock = product.stock ?? 999;
  const productKey = getItemKey(product);
  const existing = cartData.items.find(item => getItemKey(item) === productKey);

  if (existing) {
    const newQty = existing.quantity + quantity;
    if (newQty > stock) {
      throw new Error(
        `Bạn đã có ${existing.quantity} sản phẩm trong giỏ. Chỉ còn ${stock} sản phẩm trong kho!`
      );
    }
  } else {
    if (quantity > stock) {
      throw new Error(`Chỉ còn ${stock} sản phẩm trong kho!`);
    }
  }

  setCartData(prev => {
    const ex = prev.items.find(item => getItemKey(item) === productKey);
    if (ex) {
      return {
        ...prev,
        items: prev.items.map(item =>
          getItemKey(item) === productKey
            ? { ...item, quantity: ex.quantity + quantity }
            : item
        )
      };
    }
    return { ...prev, items: [...prev.items, { ...product, quantity }] };
  });
};

  const removeFromCart = async (itemKey) => {
    if (!user) {
      // Guest local storage logic
      setCartData(prev => ({
        ...prev,
        items: prev.items.filter(item => getItemKey(item) !== itemKey)
      }));
      return;
    }

    try {
      const targetItem = cartData.items.find(item => getItemKey(item) === itemKey);
      if (targetItem) {
        await cartAPI.removeItem(targetItem.id);
        await loadDbCart();
      }
    } catch (err) {
      console.error('Failed to remove from cart:', err);
      addNotification(err.message || 'Không thể xóa sản phẩm khỏi giỏ hàng', 'error');
    }
  };

  const updateQuantity = async (itemKey, quantity) => {
    if (quantity <= 0) {
      await removeFromCart(itemKey);
      return;
    }

    if (!user) {
      // Guest local storage logic
      setCartData(prev => ({
        ...prev,
        items: prev.items.map(item =>
          getItemKey(item) === itemKey ? { ...item, quantity } : item
        )
      }));
      return;
    }

    try {
      const targetItem = cartData.items.find(item => getItemKey(item) === itemKey);
      if (targetItem) {
        await cartAPI.updateItem(targetItem.id, quantity);
        await loadDbCart();
      }
    } catch (err) {
      console.error('Failed to update quantity:', err);
      addNotification(err.message || 'Không thể cập nhật số lượng sản phẩm', 'error');
    }
  };

  const clearCart = async () => {
    if (!user) {
      setCartData(prev => ({ ...prev, items: [] }));
      return;
    }

    try {
      await cartAPI.clearCart();
      await loadDbCart();
    } catch (err) {
      console.error('Failed to clear cart:', err);
      addNotification(err.message || 'Không thể xóa giỏ hàng', 'error');
    }
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
    loadDbCart
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};
