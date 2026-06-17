import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { apiClient } from '../api/app';
import '../styles/AdminCategories.css';
import LoadingSkeleton from '../components/LoadingSkeleton';

export default function AdminCategories() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
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
      setLoading(true);
      const data = await apiClient('/category');
      setCategories(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      addNotification(error.message || 'Khong the tai danh muc', 'error');
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

  const handleFormChange = (field) => (event) => {
    setFormData((current) => ({
      ...current,
      [field]: event.target.value,
    }));
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
    });
    setEditingId(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.name.trim()) {
      addNotification('Vui long nhap ten danh muc', 'warning');
      return;
    }

    try {
      await apiClient(editingId ? `/category/${editingId}` : '/category', {
        method: editingId ? 'PUT' : 'POST',
        auth: true,
        body: editingId ? { ...formData, id: editingId } : formData,
      });

      addNotification(editingId ? 'Cap nhat danh muc thanh cong' : 'Them danh muc thanh cong', 'success');
      setShowForm(false);
      resetForm();
      fetchCategories();
    } catch (error) {
      console.error('Submit error:', error);
      addNotification(error.message || 'Khong the luu danh muc', 'error');
    }
  };

  const handleEdit = (category) => {
    setFormData({
      name: category.name || '',
      description: category.description || '',
    });
    setEditingId(category.id);
    setShowForm(true);
  };

  const handleDelete = async (categoryId) => {
    if (!window.confirm('Ban chac chan muon xoa danh muc nay?')) return;

    try {
      await apiClient(`/category/${categoryId}`, {
        method: 'DELETE',
        auth: true,
      });

      addNotification('Xoa danh muc thanh cong', 'success');
      fetchCategories();
    } catch (error) {
      console.error('Delete error:', error);
      addNotification(error.message || 'Khong the xoa danh muc', 'error');
    }
  };

  if (loading) {
    return <LoadingSkeleton type="table" />;
  }

  return (
    <div className="admin-categories-page">
      <div className="admin-header">
        <h1>Quan Ly Danh Muc</h1>
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
          {showForm ? 'Quay Lai' : '+ Them Danh Muc'}
        </button>
      </div>

      {showForm ? (
        <div className="category-form-section">
          <form onSubmit={handleSubmit} className="category-form">
            <h2>{editingId ? 'Chinh Sua Danh Muc' : 'Them Danh Muc Moi'}</h2>

            <div className="form-group">
              <label>Ten Danh Muc *</label>
              <input
                type="text"
                value={formData.name}
                onChange={handleFormChange('name')}
                placeholder="Ten danh muc"
                required
              />
            </div>

            <div className="form-group">
              <label>Mo Ta</label>
              <textarea
                value={formData.description}
                onChange={handleFormChange('description')}
                placeholder="Mo ta danh muc"
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
                Huy
              </button>
              <button type="submit" className="btn-save">
                {editingId ? 'Cap Nhat' : 'Them'} Danh Muc
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="categories-list-section">
          {categories.length === 0 ? (
            <div className="no-categories">Khong co danh muc nao</div>
          ) : (
            <div className="categories-grid">
              {categories.map((category) => (
                <div key={category.id} className="category-card">
                  <div className="category-content">
                    <h3>{category.name}</h3>
                    {category.description && <p>{category.description}</p>}
                  </div>
                  <div className="category-actions">
                    <button onClick={() => handleEdit(category)} className="btn-edit">
                      Sua
                    </button>
                    <button onClick={() => handleDelete(category.id)} className="btn-delete">
                      Xoa
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
