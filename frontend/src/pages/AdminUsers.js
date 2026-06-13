import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import '../styles/AdminUsers.css';
import LoadingSkeleton from '../components/LoadingSkeleton';

export default function AdminUsers() {
  const navigate = useNavigate();
  const { token, isAdmin } = useAuth();
  const { addNotification } = useNotification();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        let errorMessage = 'Failed to load users';
        try {
          const errorData = await res.json();
          errorMessage = errorData?.message || errorMessage;
        } catch {}
        throw new Error(errorMessage);
      }
      const json = await res.json();
      setUsers(json.data || []);
    } catch (err) {
      console.error(err);
      addNotification('Lỗi khi tải danh sách người dùng', 'error');
    } finally {
      setLoading(false);
    }
  }, [token, addNotification]);

  useEffect(() => {
    if (!isAdmin()) {
      navigate('/');
      return;
    }
    fetchUsers();
  }, [fetchUsers, isAdmin, navigate]);

  const changeRole = async (userId, role) => {
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role })
      });
      let data = null;
      try {
        data = await res.json();
      } catch {
        throw new Error('Failed to update role');
      }
      if (!res.ok) throw new Error(data?.message || 'Failed');
      addNotification('Cập nhật vai trò thành công', 'success');
      fetchUsers();
    } catch (err) {
      console.error(err);
      addNotification(err.message || 'Lỗi khi cập nhật vai trò', 'error');
    }
  };

  const setActive = async (userId, isActive) => {
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/users/${userId}/activate`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isActive })
      });
      let data = null;
      try {
        data = await res.json();
      } catch {
        throw new Error('Failed to update status');
      }
      if (!res.ok) throw new Error(data?.message || 'Failed');
      addNotification('Cập nhật trạng thái thành công', 'success');
      fetchUsers();
    } catch (err) {
      console.error(err);
      addNotification(err.message || 'Lỗi khi cập nhật trạng thái', 'error');
    }
  };

  if (loading) return <LoadingSkeleton type="table" />;

  return (
    <div className="admin-users-page">
        <div className="admin-header">
          <h1>Quản Lý Người Dùng</h1>
        </div>

        {users.length === 0 ? (
          <div className="no-users">Không có người dùng</div>
        ) : (
          <div className="users-table">
            <div className="table-header">
              <span className="col-id">ID</span>
              <span className="col-username">Tên Đăng Nhập</span>
              <span className="col-email">Email</span>
              <span className="col-role">Vai Trò</span>
              <span className="col-active">Hoạt Động</span>
              <span className="col-actions">Thao Tác</span>
            </div>

            {users.map((u) => (
              <div key={u.id} className="table-row">
                <span className="col-id">#{u.id}</span>
                <span className="col-username">{u.username}</span>
                <span className="col-email">{u.email}</span>
                <span className="col-role">{u.role}</span>
                <span className="col-active">{u.isActive ? 'Hoạt' : 'Khoá'}</span>
                <span className="col-actions">
                  {u.role !== 'Admin' ? (
                    <button className="btn-promote" onClick={() => changeRole(u.id, 'Admin')}>Thăng Admin</button>
                  ) : (
                    <button className="btn-demote" onClick={() => changeRole(u.id, 'User')}>Hạ User</button>
                  )}

                  <button
                    className="btn-toggle-active"
                    onClick={() => setActive(u.id, !u.isActive)}
                  >
                    {u.isActive ? 'Khoá' : 'Kích Hoạt'}
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
