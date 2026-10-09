import React, { useCallback, useState, useEffect } from 'react';
import { faqAPI } from '../../api/app';
import { useNotification } from '../../context/NotificationContext';
import { usePreferences } from '../../context/PreferencesContext';
import '../../styles/AdminFaqs.css';

const unwrap = (res) => res?.data ?? res;

export default function AdminFaqs() {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingFaq, setEditingFaq] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { addNotification } = useNotification();
  const { t } = usePreferences();

  const [formData, setFormData] = useState({
    id: 0,
    question: '',
    answer: '',
    keywords: '',
    priority: 0,
    isActive: true,
  });

  const fetchFaqs = useCallback(async () => {
    setLoading(true);
    try {
      const data = unwrap(await faqAPI.getAll());
      setFaqs(data || []);
    } catch (err) {
      addNotification(t('admin.faq.loadError'), 'error');
    } finally {
      setLoading(false);
    }
  }, [addNotification, t]);

  useEffect(() => {
    fetchFaqs();
  }, [fetchFaqs]);

  const handleOpenModal = (faq = null) => {
    if (faq) {
      setEditingFaq(faq);
      setFormData({
        id: faq.id,
        question: faq.question,
        answer: faq.answer,
        keywords: faq.keywords,
        priority: faq.priority,
        isActive: faq.isActive,
      });
    } else {
      setEditingFaq(null);
      setFormData({
        id: 0,
        question: '',
        answer: '',
        keywords: '',
        priority: 0,
        isActive: true,
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingFaq(null);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingFaq) {
        await faqAPI.update(formData.id, formData);
        addNotification(t('admin.faq.updated'), 'success');
      } else {
        await faqAPI.create(formData);
        addNotification(t('admin.faq.created'), 'success');
      }
      handleCloseModal();
      fetchFaqs();
    } catch (err) {
      addNotification(t('admin.faq.saveError'), 'error');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm(t('admin.faq.deleteConfirm'))) {
      try {
        await faqAPI.delete(id);
        addNotification(t('admin.faq.deleted'), 'success');
        fetchFaqs();
      } catch (err) {
        addNotification(t('admin.faq.deleteError'), 'error');
      }
    }
  };

  return (
    <div className="admin-faqs">
      <div className="admin-faqs__header">
        <h2>{t('admin.faq.title')}</h2>
        <button className="btn btn-primary" onClick={() => handleOpenModal()}>
          {t('admin.faq.add')}
        </button>
      </div>

      {loading ? (
        <p>{t('checkout.submit.loading')}</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>{t('admin.faq.question')}</th>
              <th>{t('admin.faq.keywords')}</th>
              <th>{t('admin.faq.priority')}</th>
              <th>{t('admin.faq.status')}</th>
              <th>{t('admin.faq.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {faqs.map((f) => (
              <tr key={f.id}>
                <td>{f.id}</td>
                <td>{f.question}</td>
                <td>{f.keywords}</td>
                <td>{f.priority}</td>
                <td>{f.isActive ? <span className="badge badge-success">{t('admin.faq.active')}</span> : <span className="badge badge-danger">{t('admin.faq.inactive')}</span>}</td>
                <td className="actions">
                  <button className="btn-icon" onClick={() => handleOpenModal(f)}>✏️</button>
                  <button className="btn-icon" onClick={() => handleDelete(f.id)}>🗑️</button>
                </td>
              </tr>
            ))}
            {faqs.length === 0 && (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center' }}>{t('admin.faq.empty')}</td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>{editingFaq ? t('admin.faq.edit') : t('admin.faq.new')}</h3>
            <form onSubmit={handleSubmit} className="faq-form">
              <div className="form-group">
                <label>{t('admin.faq.question')}:</label>
                <input
                  type="text"
                  name="question"
                  value={formData.question}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>{t('admin.faq.keywords')}:</label>
                <input
                  type="text"
                  name="keywords"
                  value={formData.keywords}
                  onChange={handleChange}
                  required
                  placeholder={t('admin.faq.keywords.placeholder')}
                />
              </div>
              <div className="form-group">
                <label>{t('admin.faq.answer')}:</label>
                <textarea
                  name="answer"
                  value={formData.answer}
                  onChange={handleChange}
                  required
                  rows={4}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>{t('admin.faq.priorityLabel')}</label>
                  <input
                    type="number"
                    name="priority"
                    value={formData.priority}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      name="isActive"
                      checked={formData.isActive}
                      onChange={handleChange}
                    />
                    {t('admin.faq.activate')}
                  </label>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>
                  {t('admin.categories.cancel')}
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingFaq ? t('admin.categories.update') : t('admin.categories.add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
