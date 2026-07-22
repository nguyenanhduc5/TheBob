import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { blogAPI } from '../api/app';
import '../styles/Blog.css';

export default function BlogList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10));
  const [totalPages, setTotalPages] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '');
  const [search, setSearch] = useState(searchParams.get('search') || '');

  // Load categories once
  useEffect(() => {
    blogAPI.getCategories()
      .then((res) => {
        const items = res?.data || res || [];
        setCategories(items);
      })
      .catch(() => {});
  }, []);

  // Load posts whenever page/category/search changes
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    blogAPI.getPublished(page, 9, selectedCategory || undefined, search || undefined)
      .then((res) => {
        const data = res?.data || res;
        if (isMounted && data) {
          setPosts(data.items || []);
          setTotalPages(Math.ceil((data.totalCount || 0) / 9) || 1);
        }
      })
      .catch((err) => {
        console.error('Failed to load blog posts:', err);
        if (isMounted) setPosts([]);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [page, selectedCategory, search]);

  const handleCategorySelect = (catId) => {
    setSelectedCategory(catId);
    setPage(1);
    const params = {};
    if (catId) params.category = catId;
    if (search) params.search = search;
    setSearchParams(params);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    const params = {};
    if (selectedCategory) params.category = selectedCategory;
    if (search) params.search = search;
    setSearchParams(params);
  };

  return (
    <div className="blog-page-container">
      <div className="blog-hero-header">
        <span className="blog-hero-label">THEBOB JOURNAL</span>
        <h1>BLOG & BÀI VIẾT</h1>
        <p>Cập nhật tin tức, xu hướng thời trang và mẹo phối đồ mới nhất.</p>
      </div>

      <div className="blog-layout">
        {/* Sidebar Filters */}
        <aside className="blog-sidebar">
          <form className="blog-search-box" onSubmit={handleSearchSubmit}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm bài viết..."
            />
            <button type="submit">🔍</button>
          </form>

          <div className="blog-category-filter">
            <h3>Danh mục</h3>
            <ul>
              <li
                className={!selectedCategory ? 'active' : ''}
                onClick={() => handleCategorySelect('')}
              >
                Tất cả bài viết
              </li>
              {categories.map((cat) => (
                <li
                  key={cat.id}
                  className={selectedCategory === String(cat.id) ? 'active' : ''}
                  onClick={() => handleCategorySelect(String(cat.id))}
                >
                  {cat.name}
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Main Post Grid */}
        <main className="blog-main-content">
          {loading ? (
            <div className="blog-loading">Đang tải bài viết...</div>
          ) : posts.length === 0 ? (
            <div className="blog-empty-state">
              Không tìm thấy bài viết nào phù hợp.
            </div>
          ) : (
            <div className="blog-grid">
              {posts.map((post) => (
                <article
                  key={post.id}
                  className="blog-card"
                  onClick={() => {
                    blogAPI.trackClick(post.id, 'Direct').catch(() => {});
                    navigate(`/blog/${post.slug}`);
                  }}
                >
                  <div className="blog-card__image-wrap">
                    <img
                      src={post.thumbnail || '/placeholder.jpg'}
                      alt={post.title}
                      className="blog-card__image"
                    />
                    {post.categoryName && (
                      <span className="blog-card__badge">{post.categoryName}</span>
                    )}
                  </div>
                  <div className="blog-card__body">
                    <div className="blog-card__meta">
                      <span>{post.authorName || 'Admin'}</span> •{' '}
                      <span>
                        {post.publishedAt
                          ? new Date(post.publishedAt).toLocaleDateString('vi-VN')
                          : ''}
                      </span>
                    </div>
                    <h2 className="blog-card__title">{post.title}</h2>
                    <p className="blog-card__summary">{post.summary}</p>
                    <span className="blog-card__link">Đọc tiếp →</span>
                  </div>
                </article>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="blog-pagination">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← Trước
              </button>
              <span>
                Trang {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Sau →
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
