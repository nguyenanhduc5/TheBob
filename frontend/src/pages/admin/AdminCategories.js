import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { usePreferences } from '../../context/PreferencesContext';
import { apiClient } from '../../api/app';
import '../../styles/AdminCategories.css';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import AdminCollectionsPanel from '../../components/admin/collection/AdminCollectionsPanel';

export default function AdminCategories() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { addNotification } = useNotification();
  const { t } = usePreferences();

  const [categories, setCategories] = useState([]);
  const [activeSection, setActiveSection] = useState('categories');
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
      addNotification(error.message || t('admin.categories.loadError'), 'error');
    } finally {
      setLoading(false);
    }
  }, [addNotification, t]);

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
      addNotification(t('admin.categories.required'), 'warning');
      return;
    }

    try {
      await apiClient(editingId ? `/category/${editingId}` : '/category', {
        method: editingId ? 'PUT' : 'POST',
        auth: true,
        body: editingId ? { ...formData, id: editingId } : formData,
      });

      addNotification(
        editingId ? t('admin.categories.updated') : t('admin.categories.created'),
        'success'
      );
      setShowForm(false);
      resetForm();
      fetchCategories();
    } catch (error) {
      console.error('Submit error:', error);
      addNotification(error.message || t('admin.categories.saved.error'), 'error');
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
    if (!window.confirm(t('admin.categories.confirmDelete'))) return;

    try {
      await apiClient(`/category/${categoryId}`, {
        method: 'DELETE',
        auth: true,
      });

      addNotification(t('admin.categories.deleted'), 'success');
      fetchCategories();
    } catch (error) {
      console.error('Delete error:', error);
      addNotification(error.message || t('admin.categories.delete.error'), 'error');
    }
  };

  if (loading) {
    return <LoadingSkeleton type="table" />;
  }

  return (
    <div className="admin-categories-page">
      <div className="catalog-admin-tabs" role="tablist" aria-label="Quản lý danh mục và bộ sưu tập">
        <button
          type="button"
          role="tab"
          aria-selected={activeSection === 'categories'}
          className={activeSection === 'categories' ? 'active' : ''}
          onClick={() => setActiveSection('categories')}
        >
          Danh mục sản phẩm
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeSection === 'collections'}
          className={activeSection === 'collections' ? 'active' : ''}
          onClick={() => setActiveSection('collections')}
        >
          Bộ sưu tập
        </button>
      </div>

      {activeSection === 'collections' ? <AdminCollectionsPanel /> : <>
      <div className="admin-header">
        <h1>{t('admin.categories.title')}</h1>
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
          {showForm ? t('admin.categories.back') : t('admin.categories.add')}
        </button>
      </div>

      {showForm ? (
        <div className="category-form-section">
          <form onSubmit={handleSubmit} className="category-form">
            <h2>{editingId ? t('admin.categories.edit') : t('admin.categories.new')}</h2>

            <div className="form-group">
              <label>{t('admin.categories.name')}</label>
              <input
                type="text"
                value={formData.name}
                onChange={handleFormChange('name')}
                placeholder={t('admin.categories.name.placeholder')}
                required
              />
            </div>

            <div className="form-group">
              <label>{t('admin.categories.description')}</label>
              <textarea
                value={formData.description}
                onChange={handleFormChange('description')}
                placeholder={t('admin.categories.description.placeholder')}
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
                {t('admin.categories.cancel')}
              </button>
              <button type="submit" className="btn-save">
                {editingId ? t('admin.categories.update') : t('admin.categories.save')}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="categories-list-section">
          {categories.length === 0 ? (
            <div className="no-categories">{t('admin.categories.empty')}</div>
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
                      {t('admin.categories.editAction')}
                    </button>
                    <button onClick={() => handleDelete(category.id)} className="btn-delete">
                      {t('admin.categories.delete')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      </>}
    </div>
  );
}
