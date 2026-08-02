import React, { useState, useEffect } from 'react';
import { faqAPI } from '../api/app';
import { useNotification } from '../context/NotificationContext';
import '../styles/AdminFaqs.css';

const unwrap = (res) => res?.data ?? res;

export default function AdminFaqs() {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingFaq, setEditingFaq] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { addNotification } = useNotification();

  const [formData, setFormData] = useState({
    id: 0,
    question: '',
    answer: '',
    keywords: '',
    priority: 0,
    isActive: true,
  });

  useEffect(() => {
    fetchFaqs();
  }, []);

  const fetchFaqs = async () => {
    setLoading(true);
    try {
      const data = unwrap(await faqAPI.getAll());
      setFaqs(data || []);
    } catch (err) {
      addNotification('Lỗi khi tải danh sách FAQ', 'error');
    } finally {
      setLoading(false);
    }
  };

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
        addNotification('Cập nhật FAQ thành công!', 'success');
      } else {
        await faqAPI.create(formData);
        addNotification('Tạo mới FAQ thành công!', 'success');
      }
      handleCloseModal();
      fetchFaqs();
    } catch (err) {
      addNotification('Có lỗi xảy ra khi lưu FAQ', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xoá FAQ này?')) {
      try {
        await faqAPI.delete(id);
        addNotification('Xoá FAQ thành công!', 'success');
        fetchFaqs();
      } catch (err) {
        addNotification('Lỗi khi xoá FAQ', 'error');
      }
    }
  };

  return (
    <div className="admin-faqs">
      <div className="admin-faqs__header">
        <h2>Quản lý FAQ (Hệ thống AI trả lời)</h2>
        <button className="btn btn-primary" onClick={() => handleOpenModal()}>
          + Thêm FAQ
        </button>
      </div>

      {loading ? (
        <p>Đang tải...</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Câu hỏi</th>
              <th>Keywords</th>
              <th>Mức ưu tiên</th>
              <th>Trạng thái</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {faqs.map((f) => (
              <tr key={f.id}>
                <td>{f.id}</td>
                <td>{f.question}</td>
                <td>{f.keywords}</td>
                <td>{f.priority}</td>
                <td>{f.isActive ? <span className="badge badge-success">Active</span> : <span className="badge badge-danger">Inactive</span>}</td>
                <td className="actions">
                  <button className="btn-icon" onClick={() => handleOpenModal(f)}>✏️</button>
                  <button className="btn-icon" onClick={() => handleDelete(f.id)}>🗑️</button>
                </td>
              </tr>
            ))}
            {faqs.length === 0 && (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center' }}>Chưa có FAQ nào.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>{editingFaq ? 'Chỉnh sửa FAQ' : 'Thêm mới FAQ'}</h3>
            <form onSubmit={handleSubmit} className="faq-form">
              <div className="form-group">
                <label>Câu hỏi:</label>
                <input
                  type="text"
                  name="question"
                  value={formData.question}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Keywords (cách nhau bởi dấu phẩy):</label>
                <input
                  type="text"
                  name="keywords"
                  value={formData.keywords}
                  onChange={handleChange}
                  required
                  placeholder="VD: giá, ship, bảo hành"
                />
              </div>
              <div className="form-group">
                <label>Câu trả lời:</label>
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
                  <label>Mức ưu tiên (Priority):</label>
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
                    Kích hoạt
                  </label>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingFaq ? 'Cập nhật' : 'Thêm mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
