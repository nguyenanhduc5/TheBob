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

export default function AdminUsers() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { addNotification } = useNotification();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await apiClient('/users', { auth: true });
      setUsers(getUsersArray(payload));
    } catch (error) {
      console.error(error);
      addNotification(error.message || 'Khong the tai danh sach nguoi dung', 'error');
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
    try {
      await apiClient(`/users/${userId}/role`, {
        method: 'PUT',
        auth: true,
        body: { role },
      });
      addNotification('Cap nhat vai tro thanh cong', 'success');
      fetchUsers();
    } catch (error) {
      console.error(error);
      addNotification(error.message || 'Khong the cap nhat vai tro', 'error');
    }
  };

  const setActive = async (userId, isActive) => {
    try {
      await apiClient(`/users/${userId}/activate`, {
        method: 'PUT',
        auth: true,
        body: { isActive },
      });
      addNotification('Cap nhat trang thai thanh cong', 'success');
      fetchUsers();
    } catch (error) {
      console.error(error);
      addNotification(error.message || 'Khong the cap nhat trang thai', 'error');
    }
  };

  if (loading) return <LoadingSkeleton type="table" />;

  return (
    <div className="admin-users-page">
      <div className="admin-header">
        <h1>Quan Ly Nguoi Dung</h1>
      </div>

      {users.length === 0 ? (
        <div className="no-users">Khong co nguoi dung</div>
      ) : (
        <div className="users-table">
          <div className="table-header">
            <span className="col-id">ID</span>
            <span className="col-username">Ten Dang Nhap</span>
            <span className="col-email">Email</span>
            <span className="col-role">Vai Tro</span>
            <span className="col-active">Hoat Dong</span>
            <span className="col-actions">Thao Tac</span>
          </div>

          {users.map((user) => (
            <div key={user.id} className="table-row">
              <span className="col-id">#{user.id}</span>
              <span className="col-username">{user.username || user.name || '-'}</span>
              <span className="col-email">{user.email || '-'}</span>
              <span className="col-role">{user.role || 'User'}</span>
              <span className="col-active">{user.isActive ? 'Hoat' : 'Khoa'}</span>
              <span className="col-actions">
                {user.role !== 'Admin' ? (
                  <button className="btn-promote" onClick={() => changeRole(user.id, 'Admin')}>
                    Thang Admin
                  </button>
                ) : (
                  <button className="btn-demote" onClick={() => changeRole(user.id, 'User')}>
                    Ha User
                  </button>
                )}

                <button className="btn-toggle-active" onClick={() => setActive(user.id, !user.isActive)}>
                  {user.isActive ? 'Khoa' : 'Kich Hoat'}
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
