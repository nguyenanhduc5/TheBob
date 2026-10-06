import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { blogAPI } from '../../api/app';

export default function FeaturedBlogSection() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    blogAPI.getFeatured()
      .then((res) => {
        const items = res?.data || res || [];
        if (isMounted) {
          setPosts(items);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setPosts([]);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading || posts.length === 0) return null;

  return (
    <section className="featured-blog-section">
      <div className="featured-blog-header">
        <span className="featured-blog-subtitle">TẠP CHÍ & BÀI VIẾT</span>
        <h2 className="featured-blog-title">BÀI VIẾT NỔI BẬT</h2>
        <p className="featured-blog-desc">
          Cập nhật xu hướng thời trang, mẹo phối đồ và phong cách sống từ THEBOB
        </p>
      </div>

      <div className="featured-blog-grid">
        {posts.map((post) => (
          <article
            key={post.id}
            className="featured-blog-card"
            onClick={() => {
              blogAPI.trackClick(post.id, 'Home').catch(() => {});
              navigate(`/blog/${post.slug}`);
            }}
          >
            <div className="featured-blog-card__image-wrap">
              <img
                src={post.thumbnail || '/placeholder.jpg'}
                alt={post.title}
                className="featured-blog-card__image"
              />
              {post.categoryName && (
                <span className="featured-blog-card__category">
                  {post.categoryName}
                </span>
              )}
            </div>

            <div className="featured-blog-card__content">
              <div className="featured-blog-card__date">
                {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('vi-VN') : ''}
              </div>
              <h3 className="featured-blog-card__title">{post.title}</h3>
              <p className="featured-blog-card__summary">{post.summary}</p>
              <span className="featured-blog-card__link">Đọc bài viết →</span>
            </div>
          </article>
        ))}
      </div>

      <div className="featured-blog-footer">
        <button
          type="button"
          className="bob-btn-light"
          onClick={() => navigate('/blog')}
        >
          XEM TẤT CẢ BÀI VIẾT
        </button>
      </div>
    </section>
  );
}
