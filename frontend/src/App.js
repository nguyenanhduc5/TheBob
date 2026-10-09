import React from 'react';
import { BrowserRouter as Router, Navigate, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { NotificationProvider } from './context/NotificationContext';
import { PreferencesProvider } from './context/PreferencesContext';
import Header from './components/Header';
import Footer from './components/Footer';
import NotificationDisplay from './components/NotificationDisplay';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import AdminLayoutWrapper from './components/AdminLayoutWrapper';
// Client Pages
import Home from './pages/client/Home';
import Products from './pages/client/Products';
import ProductDetail from './pages/client/ProductDetail';
import CollectionList from './pages/client/Collection';
import CollectionDetail from './pages/client/CollectionDetail';
import Cart from './pages/client/Cart';
import Checkout from './pages/client/Checkout';
import OrderDetail from './pages/client/OrderDetail';
import BlogList from './pages/client/BlogList';
import BlogDetail from './pages/client/BlogDetail';
import AboutUs from './pages/client/AboutUs';
import MyVouchers from './pages/client/MyVouchers';

// Auth Pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import Profile from './pages/auth/Profile';

// Payment Pages
import PaymentPage from './pages/payment/PaymentPage';
import PaymentSuccess from './pages/payment/PaymentSuccess';
import PaymentFailed from './pages/payment/PaymentFailed';
import PaymentExpired from './pages/payment/PaymentExpired';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminProducts from './pages/admin/AdminProducts';
import AdminCategories from './pages/admin/AdminCategories';
import AdminOrders from './pages/admin/AdminOrders';
import AdminPayments from './pages/admin/AdminPayments';
import AdminUsers from './pages/admin/AdminUsers';
import AdminPromotions from './pages/admin/AdminPromotions';
import AdminSettings from './pages/admin/AdminSettings';
import AdminChat from './pages/admin/AdminChat';
import AdminFaqs from './pages/admin/AdminFaqs';
import AdminBlog from './pages/admin/AdminBlog';

import ChatWidget from './components/chat/ChatWidget';
import './App.css';

function AppLayout() {
const location = useLocation();
const isAdminRoute = location.pathname.startsWith('/admin');
const isHomePage = location.pathname === '/';

  React.useEffect(() => {
    // ✅ Chỉ reset overflow, KHÔNG scroll về đầu ở đây
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';
  }, [location]);

  // ✅ Scroll về đầu CHỈ khi pathname thay đổi (chuyển trang thật sự)
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]); // ← Chỉ theo dõi pathname, không phải toàn bộ location

  return (
    <>
      <Header />
      <NotificationDisplay />
      <main className={`main-content${isHomePage ? ' main-content--home' : ''}${isAdminRoute ? ' main-content--admin' : ''}`}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/products" element={<Products />} />
          <Route path="/product/:slug" element={<ProductDetail />} />
          <Route path="/products/:slug" element={<ProductDetail />} />
          <Route path="/blog" element={<BlogList />} />
          <Route path="/blog/:slug" element={<BlogDetail />} />
          <Route path="/about" element={<AboutUs />} />
          <Route path="/collections" element={<CollectionList />} />
          <Route path="/collections/:collectionId" element={<CollectionDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
          <Route path="/orders/:orderId" element={<ProtectedRoute><OrderDetail /></ProtectedRoute>} />
          <Route path="/payment/:orderId" element={<ProtectedRoute><PaymentPage /></ProtectedRoute>} />
          <Route path="/payment/success" element={<ProtectedRoute><PaymentSuccess /></ProtectedRoute>} />
          <Route path="/payment/failed" element={<ProtectedRoute><PaymentFailed /></ProtectedRoute>} />
          <Route path="/payment/expired" element={<ProtectedRoute><PaymentExpired /></ProtectedRoute>} />
          <Route path="/user/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/user/vouchers" element={<ProtectedRoute><MyVouchers /></ProtectedRoute>} />
          <Route path="/my-vouchers" element={<ProtectedRoute><MyVouchers /></ProtectedRoute>} />
          
          {/* Admin Routes - Nested with shared AdminLayoutWrapper */}
          <Route
            path="/admin/*"
            element={
              <AdminRoute>
                <AdminLayoutWrapper />
              </AdminRoute>
            }
          >
            <Route path="" element={<AdminDashboard />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="products/new" element={<AdminProducts />} />
            <Route path="products/:id/edit" element={<AdminProducts />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="payments" element={<AdminPayments />} />
            <Route path="coupons" element={<Navigate to="/admin/promotions" replace />} />
            <Route path="promotions" element={<AdminPromotions />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="chat" element={<AdminChat />} />
            <Route path="faqs" element={<AdminFaqs />} />
            <Route path="blog" element={<AdminBlog />} />
          </Route>
        </Routes>
      </main>
      
      {!isAdminRoute && <Footer />}
      {!isAdminRoute && <ChatWidget />}
    </>
  );
}

function App() {
  return (
    <PreferencesProvider>
      <NotificationProvider>
        <AuthProvider>
          <CartProvider>
            <Router>
              <AppLayout />
            </Router>
          </CartProvider>
        </AuthProvider>
      </NotificationProvider>
    </PreferencesProvider>
  );
}

export default App;
