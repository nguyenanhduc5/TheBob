import { Link } from 'react-router-dom';
import './AdminLayout.css';

export default function AdminLayout({ title, children }) {
  return (
    <div className="admin-wrapper">
      <aside className="admin-sidebar">
        <div className="admin-brand">THEBOB</div>
        <nav className="admin-nav">
          <Link to="/admin" className="nav-item">Bảng Điều Khiển</Link>
          <Link to="/admin/products" className="nav-item">Sản Phẩm</Link>
          <Link to="/admin/categories" className="nav-item">Danh Mục</Link>
          <Link to="/admin/orders" className="nav-item">Đơn Hàng</Link>
          <Link to="/admin/users" className="nav-item">Người Dùng</Link>
          <Link to="/admin/settings" className="nav-item">Cài Đặt</Link>
        </nav>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="topbar-left">
            <h2>{title}</h2>
          </div>
          <div className="topbar-right">Xin chào, Admin</div>
        </header>

        <main className="admin-content">{children}</main>
      </div>
    </div>
  );
}
