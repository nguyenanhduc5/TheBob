import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { apiClient } from '../api/app';
import '../styles/AdminUsers.css';
import LoadingSkeleton from '../components/LoadingSkeleton';

const getUsersArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const getInitial = (user) => {
  const text = user.username || user.name || user.email || '?';
  return text.charAt(0).toUpperCase();
};

export default function AdminUsers() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { addNotification } = useNotification();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await apiClient('/users', { auth: true });
      setUsers(getUsersArray(payload));
    } catch (error) {
      console.error(error);
      addNotification(error.message || 'Không thể tải danh sách người dùng', 'error');
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => {
    if (!isAdmin()) {
      navigate('/');
      return;
    }
    fetchUsers();
  }, [fetchUsers, isAdmin, navigate]);

  const changeRole = async (userId, role) => {
    setProcessingId(userId);
    try {
      await apiClient(`/users/${userId}/role`, {
        method: 'PUT',
        auth: true,
        body: { role },
      });
      addNotification('Cập nhật vai trò thành công', 'success');
      fetchUsers();
    } catch (error) {
      console.error(error);
      addNotification(error.message || 'Không thể cập nhật vai trò', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const setActive = async (userId, isActive) => {
    setProcessingId(userId);
    try {
      await apiClient(`/users/${userId}/activate`, {
        method: 'PUT',
        auth: true,
        body: { isActive },
      });
      addNotification('Cập nhật trạng thái thành công', 'success');
      fetchUsers();
    } catch (error) {
      console.error(error);
      addNotification(error.message || 'Không thể cập nhật trạng thái', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) return <LoadingSkeleton type="table" />;

  return (
    <div className="admin-users-page">
      <div className="admin-header">
        <div>
          <h1>Quản Lý Người Dùng</h1>
          <p className="admin-subtitle">{users.length} người dùng trong hệ thống</p>
        </div>
      </div>

      {users.length === 0 ? (
        <div className="no-users">
          <span className="no-users-icon">👥</span>
          <p>Không có người dùng nào</p>
        </div>
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

          {users.map((user) => (
            <div key={user.id} className={`table-row ${processingId === user.id ? 'is-processing' : ''}`}>
              <span className="col-id">#{user.id}</span>

              <span className="col-username">
                <span className="user-avatar">{getInitial(user)}</span>
                <span className="user-name">{user.username || user.name || '-'}</span>
              </span>

              <span className="col-email">{user.email || '-'}</span>

              <span className="col-role">
                <span className={`badge badge-role ${user.role === 'Admin' ? 'badge-role-admin' : 'badge-role-user'}`}>
                  {user.role === 'Admin' ? '👑 Admin' : 'Người Dùng'}
                </span>
              </span>

              <span className="col-active">
                <span className={`badge badge-status ${user.isActive ? 'badge-status-active' : 'badge-status-locked'}`}>
                  <span className="status-dot" />
                  {user.isActive ? 'Hoạt Động' : 'Đã Khóa'}
                </span>
              </span>

              <span className="col-actions">
                {user.role !== 'Admin' ? (
                  <button
                    className="btn-action btn-promote"
                    onClick={() => changeRole(user.id, 'Admin')}
                    disabled={processingId === user.id}
                  >
                    Thăng Admin
                  </button>
                ) : (
                  <button
                    className="btn-action btn-demote"
                    onClick={() => changeRole(user.id, 'User')}
                    disabled={processingId === user.id}
                  >
                    Hạ Xuống User
                  </button>
                )}

                <button
                  className={`btn-action ${user.isActive ? 'btn-lock' : 'btn-unlock'}`}
                  onClick={() => setActive(user.id, !user.isActive)}
                  disabled={processingId === user.id}
                >
                  {user.isActive ? 'Khóa' : 'Kích Hoạt'}
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}