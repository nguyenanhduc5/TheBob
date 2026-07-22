import React, { useEffect, useState, useCallback } from 'react';
import { blogAPI } from '../api/app';
import BlogPostEditor from '../components/blog/BlogPostEditor';
import BlogNotifyModal from '../components/blog/BlogNotifyModal';
import '../styles/Blog.css';

export default function AdminBlog() {
  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Filters
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');

  // Editor & Notify Modal states
  const [editingPost, setEditingPost] = useState(null); // null = list mode, 'new' = create, object = edit
  const [notifyPost, setNotifyPost] = useState(null); // blogPost object to notify
  const [toast, setToast] = useState('');

  const loadCategories = useCallback(async () => {
    try {
      const res = await blogAPI.getCategories();
      setCategories(res?.data || res || []);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  }, []);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await blogAPI.adminGetAll(
        page,
        15,
        statusFilter || undefined,
        categoryFilter ? parseInt(categoryFilter, 10) : undefined,
        search || undefined
      );
      const data = res?.data || res;
      if (data) {
        setPosts(data.items || []);
        setTotalPages(Math.ceil((data.totalCount || 0) / 15) || 1);
      }
    } catch (err) {
      console.error('Failed to load admin blog posts:', err);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, categoryFilter, search]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  const handleCreateNew = () => {
    setEditingPost('new');
  };

  const handleEdit = async (postId) => {
    try {
      setLoading(true);
      const res = await blogAPI.adminGetById(postId);
      const data = res?.data || res;
      setEditingPost(data);
    } catch (err) {
      showToast('Không thể tải chi tiết bài viết.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (postId) => {
    if (!window.confirm('Bạn có chắc chắn muốn lưu trữ (Archive) bài viết này?')) return;
    try {
      await blogAPI.delete(postId);
      showToast('Đã lưu trữ bài viết.');
      loadPosts();
    } catch (err) {
      showToast(err?.message || 'Lỗi khi xóa bài viết.');
    }
  };

  const handleSavePost = async (payload) => {
    setSaving(true);
    try {
      if (editingPost === 'new') {
        await blogAPI.create(payload);
        showToast('Đã tạo bài viết thành công!');
      } else {
        await blogAPI.update(editingPost.id, payload);
        showToast('Đã cập nhật bài viết thành công!');
      }
      setEditingPost(null);
      loadPosts();
    } catch (err) {
      alert(err?.message || 'Lỗi khi lưu bài viết.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-blog-page">
      {toast && <div className="admin-toast">{toast}</div>}

      <div className="admin-blog-header">
        <div>
          <h1>📝 Quản Lý Bài Viết Blog</h1>
          <p>Tạo, chỉnh sửa, gắn sản phẩm và gửi thông báo bài viết đến khách hàng</p>
        </div>

        {editingPost === null && (
          <button type="button" className="btn-primary" onClick={handleCreateNew}>
            + Tạo Bài Viết Mới
          </button>
        )}
      </div>

      {editingPost !== null ? (
        /* Editor Mode */
        <div className="admin-blog-editor-wrap">
          <BlogPostEditor
            initialData={editingPost === 'new' ? null : editingPost}
            categories={categories}
            onSave={handleSavePost}
            onCancel={() => setEditingPost(null)}
            saving={saving}
          />
        </div>
      ) : (
        /* List Mode */
        <>
          {/* Filters Bar */}
          <div className="admin-blog-filters">
            <input
              type="text"
              placeholder="Tìm theo tiêu đề..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="">-- Tất cả danh mục --</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">-- Tất cả trạng thái --</option>
              <option value="Draft">Draft (Nháp)</option>
              <option value="Published">Published (Đã xuất bản)</option>
              <option value="Archived">Archived (Lưu trữ)</option>
            </select>

            <button type="button" onClick={loadPosts} className="btn-secondary">
              Làm mới
            </button>
          </div>

          {/* Table */}
          {loading ? (
            <div className="admin-blog-loading">Đang tải danh sách bài viết...</div>
          ) : posts.length === 0 ? (
            <div className="admin-blog-empty">Chưa có bài viết nào.</div>
          ) : (
            <div className="admin-table-responsive">
              <table className="admin-blog-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Thumbnail</th>
                    <th>Tiêu đề</th>
                    <th>Danh mục</th>
                    <th>Trạng thái</th>
                    <th>Trang chủ</th>
                    <th>Ngày tạo</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((post) => (
                    <tr key={post.id}>
                      <td>#{post.id}</td>
                      <td>
                        <img
                          src={post.thumbnail || '/placeholder.jpg'}
                          alt={post.title}
                          className="admin-blog-thumb"
                        />
                      </td>
                      <td>
                        <strong>{post.title}</strong>
                        <br />
                        <small className="admin-blog-slug-text">/blog/{post.slug}</small>
                      </td>
                      <td>{post.categoryName || '—'}</td>
                      <td>
                        <span className={`status-badge status-${post.status.toLowerCase()}`}>
                          {post.status}
                        </span>
                      </td>
                      <td>
                        {post.isFeaturedHome ? (
                          <span className="badge-featured">⭐ Nổi bật (#{post.homeDisplayOrder})</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{new Date(post.createdAt).toLocaleDateString('vi-VN')}</td>
                      <td>
                        <div className="action-buttons">
                          <button
                            type="button"
                            className="btn-action edit"
                            onClick={() => handleEdit(post.id)}
                            title="Sửa bài viết"
                          >
                            ✏️ Sửa
                          </button>
                          {post.status === 'Published' && (
                            <button
                              type="button"
                              className="btn-action notify"
                              onClick={() => setNotifyPost(post)}
                              title="Gửi thông báo đến người dùng"
                            >
                              📢 Gửi Notify
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn-action delete"
                            onClick={() => handleDelete(post.id)}
                            title="Lưu trữ bài viết"
                          >
                            🗑️ Archive
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="admin-blog-pagination">
              <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                ← Trước
              </button>
              <span>
                Trang {page} / {totalPages}
              </span>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                Sau →
              </button>
            </div>
          )}
        </>
      )}

      {/* Notify Modal */}
      {notifyPost && (
        <BlogNotifyModal
          blogPost={notifyPost}
          onClose={() => setNotifyPost(null)}
          onSuccess={(msg) => showToast(msg)}
        />
      )}
    </div>
  );
}
