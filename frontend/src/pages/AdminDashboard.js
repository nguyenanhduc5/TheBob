import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import '../styles/AdminDashboard.css';
import AdminLayout from '../components/AdminLayout';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { addNotification } = useNotification();

  const [stats, setStats] = useState({
    totalProducts: 0,
    totalCategories: 0,
    totalOrders: 0,
    totalRevenue: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      // Fetch products count
      const productsRes = await fetch('http://localhost:5110/api/products');
      const products = productsRes.ok ? await productsRes.json() : [];

      // Fetch categories count
      const categoriesRes = await fetch('http://localhost:5110/api/category');
      const categories = categoriesRes.ok ? await categoriesRes.json() : [];

      setStats({
        totalProducts: products.length,
        totalCategories: categories.length,
        totalOrders: 0, // Will be updated when orders API is ready
        totalRevenue: 0, // Will be updated when orders API is ready
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      addNotification('Lỗi khi tải thống kê', 'error');
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => {
    if (!isAdmin()) {
      navigate('/');
      return;
    }
    fetchStats();
  }, [fetchStats, isAdmin, navigate]);

  if (loading) {
    return <div className="loading-page">Đang tải...</div>;
  }

  return (
    <AdminLayout title="Bảng Điều Khiển">
      <div className="admin-dashboard-page">
        <div className="dashboard-header">
          <h1>Bảng Điều Khiển Quản Trị</h1>
          <p>Quản lý cửa hàng THEBOB của bạn</p>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">📦</div>
            <div className="stat-content">
              <div className="stat-label">Tổng Sản Phẩm</div>
              <div className="stat-value">{stats.totalProducts}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">📂</div>
            <div className="stat-content">
              <div className="stat-label">Danh Mục</div>
              <div className="stat-value">{stats.totalCategories}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">📋</div>
            <div className="stat-content">
              <div className="stat-label">Đơn Hàng</div>
              <div className="stat-value">{stats.totalOrders}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">💰</div>
            <div className="stat-content">
              <div className="stat-label">Doanh Thu</div>
              <div className="stat-value">
                {stats.totalRevenue.toLocaleString('vi-VN')} VNĐ
              </div>
            </div>
          </div>
        </div>

        <div className="admin-menu">
          <h2>Quản Lý</h2>
          <div className="menu-grid">
            <button
              onClick={() => navigate('/admin/products')}
              className="menu-item"
            >
              <div className="menu-icon">📦</div>
              <div className="menu-label">Sản Phẩm</div>
              <div className="menu-sublabel">Thêm, sửa, xóa sản phẩm</div>
            </button>

            <button
              onClick={() => navigate('/admin/categories')}
              className="menu-item"
            >
              <div className="menu-icon">📂</div>
              <div className="menu-label">Danh Mục</div>
              <div className="menu-sublabel">Quản lý danh mục sản phẩm</div>
            </button>

            <button
              onClick={() => navigate('/admin/orders')}
              className="menu-item"
            >
              <div className="menu-icon">📋</div>
              <div className="menu-label">Đơn Hàng</div>
              <div className="menu-sublabel">Xem và quản lý đơn hàng</div>
            </button>

            <button
              onClick={() => navigate('/admin/users')}
              className="menu-item"
            >
              <div className="menu-icon">👥</div>
              <div className="menu-label">Người Dùng</div>
              <div className="menu-sublabel">Quản lý tài khoản người dùng</div>
            </button>

            <button
              onClick={() => navigate('/admin/settings')}
              className="menu-item"
            >
              <div className="menu-icon">⚙️</div>
              <div className="menu-label">Cài Đặt</div>
              <div className="menu-sublabel">Cấu hình cửa hàng</div>
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
