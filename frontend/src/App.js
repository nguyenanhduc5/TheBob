import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import { NotificationProvider } from './context/NotificationContext';
import Header from './components/Header';
import Footer from './components/Footer';
import NotificationDisplay from './components/NotificationDisplay';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import './App.css';

function AppLayout() {
  const location = useLocation();
  const hideHeaderPages = ['/login', '/register'];
  const showHeader = !hideHeaderPages.includes(location.pathname);

  return (
    <>
      {showHeader && <Header />}
      <NotificationDisplay />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/user/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/admin/profile" element={<AdminRoute><Profile /></AdminRoute>} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}

function App() {
  return (
    <NotificationProvider>
      <AuthProvider>
        <WishlistProvider>
          <CartProvider>
            <Router>
              <AppLayout />
            </Router>
          </CartProvider>
        </WishlistProvider>
      </AuthProvider>
    </NotificationProvider>
  );
}

export default App;
