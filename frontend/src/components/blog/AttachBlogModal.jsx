import React, { useState, useEffect } from 'react';
import { blogAPI } from '../../api/app';

export default function AttachBlogModal({ onClose, onSelect }) {
  const [posts, setPosts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    blogAPI.searchPublishedPosts(search, 20)
      .then((res) => {
        const items = res?.data || res || [];
        if (isMounted) setPosts(items);
      })
      .catch(() => {
        if (isMounted) setPosts([]);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [search]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content attach-blog-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>📎 Đính Kèm Bài Viết Về Chat</h3>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm bài viết theo tiêu đề..."
              autoFocus
            />
          </div>

          {loading ? (
            <div className="attach-blog-loading">Đang tải danh sách bài viết...</div>
          ) : posts.length === 0 ? (
            <div className="attach-blog-empty">Không tìm thấy bài viết nào đã xuất bản.</div>
          ) : (
            <div className="attach-blog-list">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="attach-blog-item"
                  onClick={() => {
                    onSelect(post);
                    onClose();
                  }}
                >
                  <img src={post.thumbnail || '/placeholder.jpg'} alt={post.title} />
                  <div className="attach-blog-item-info">
                    <h4>{post.title}</h4>
                    <p>{post.summary || 'Không có mô tả'}</p>
                    <span className="attach-blog-slug">/blog/{post.slug}</span>
                  </div>
                  <button type="button" className="btn-select-blog">
                    Gửi ngay
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
