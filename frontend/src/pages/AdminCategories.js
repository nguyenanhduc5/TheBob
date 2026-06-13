import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import '../styles/AdminCategories.css';
import LoadingSkeleton from '../components/LoadingSkeleton';

export default function AdminCategories() {
  const navigate = useNavigate();
  const { token, isAdmin } = useAuth();
  const { addNotification } = useNotification();

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  const fetchCategories = useCallback(async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/category`);
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      addNotification('Lỗi khi tải danh mục', 'error');
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => {
    if (!isAdmin()) {
      navigate('/');
      return;
    }
    fetchCategories();
  }, [fetchCategories, isAdmin, navigate]);

  const handleFormChange = (field) => (e) => {
    setFormData({
      ...formData,
      [field]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      addNotification('Vui lòng nhập tên danh mục', 'warning');
      return;
    }

    try {
      const url = editingId
        ? `${process.env.REACT_APP_API_URL}/category/${editingId}`
        : `${process.env.REACT_APP_API_URL}/category`;

      const method = editingId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(editingId ? { ...formData, id: editingId } : formData),
      });

     const result = await response.json();

if (!response.ok) {
  addNotification(
    result.message || 'Không thể lưu danh mục',
    'warning'
  );
  return;
}

addNotification(
  result.message ||
  (editingId
    ? 'Cập nhật danh mục thành công'
    : 'Thêm danh mục thành công'),
  'success'
);

setShowForm(false);
resetForm();
fetchCategories();
    } catch (error) {
      console.error('Submit error:', error);
      addNotification('Lỗi khi lưu danh mục', 'error');
    }
  };

  const handleEdit = (category) => {
    setFormData({
      name: category.name,
      description: category.description || '',
    });
    setEditingId(category.id);
    setShowForm(true);
  };

  const handleDelete = async (categoryId) => {
    if (!window.confirm('Bạn chắc chắn muốn xóa danh mục này?')) {
      return;
    }

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/category/${categoryId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        addNotification('Xóa danh mục thành công', 'success');
        fetchCategories();
      } else {
        let message = 'Lỗi khi xóa danh mục';
        try {
          const errorData = await response.json();
          message = errorData?.message || message;
        } catch {
          message = `${message} (${response.status})`;
        }
        addNotification(message, 'error');
      }
    } catch (error) {
      console.error('Delete error:', error);
      addNotification('Lỗi khi xóa danh mục', 'error');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
    });
    setEditingId(null);
  };

  if (loading) {
    return <LoadingSkeleton type="table" />;
  }

  return (
    <div className="admin-categories-page">
      <div className="admin-header">
        <h1>Quản Lý Danh Mục</h1>
        <button
          onClick={() => {
            if (showForm) {
              setShowForm(false);
              resetForm();
            } else {
              setShowForm(true);
            }
          }}
          className="btn-add-category"
        >
          {showForm ? '← Quay Lại' : '+ Thêm Danh Mục'}
        </button>
      </div>

      {showForm ? (
        <div className="category-form-section">
          <form onSubmit={handleSubmit} className="category-form">
            <h2>{editingId ? 'Chỉnh Sửa Danh Mục' : 'Thêm Danh Mục Mới'}</h2>

            <div className="form-group">
              <label>Tên Danh Mục *</label>
              <input
                type="text"
                value={formData.name}
                onChange={handleFormChange('name')}
                placeholder="Tên danh mục"
                required
              />
            </div>

            <div className="form-group">
              <label>Mô Tả</label>
              <textarea
                value={formData.description}
                onChange={handleFormChange('description')}
                placeholder="Mô tả danh mục"
                rows={4}
              />
            </div>

            <div className="form-actions">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="btn-cancel"
              >
                Hủy
              </button>
              <button type="submit" className="btn-save">
                {editingId ? 'Cập Nhật' : 'Thêm'} Danh Mục
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="categories-list-section">
          {categories.length === 0 ? (
            <div className="no-categories">Không có danh mục nào</div>
          ) : (
            <div className="categories-grid">
              {categories.map((category) => (
                <div key={category.id} className="category-card">
                  <div className="category-content">
                    <h3>{category.name}</h3>
                    {category.description && (
                      <p>{category.description}</p>
                    )}
                  </div>
                  <div className="category-actions">
                    <button
                      onClick={() => handleEdit(category)}
                      className="btn-edit"
                    >
                      Sửa
                    </button>
                    <button
                      onClick={() => handleDelete(category.id)}
                      className="btn-delete"
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
