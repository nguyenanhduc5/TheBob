import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { blogAPI } from '../api/app';
import BlogProductCard from '../components/blog/BlogProductCard';
import '../styles/Blog.css';

export default function BlogDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const source = searchParams.get('source') || 'Direct';

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError('');

    blogAPI.getBySlug(slug)
      .then((res) => {
        const data = res?.data || res;
        if (isMounted && data) {
          setPost(data);
          // Fire-and-forget page view track
          blogAPI.trackClick(data.id, source).catch(() => {});
        } else if (isMounted) {
          setError('Không tìm thấy bài viết.');
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err?.message || 'Không thể tải nội dung bài viết.');
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [slug, source]);

  if (loading) {
    return (
      <div className="blog-detail-container">
        <div className="blog-loading">Đang tải bài viết...</div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="blog-detail-container">
        <div className="blog-error-state">
          <h2>{error || 'Bài viết không tồn tại'}</h2>
          <button className="bob-btn-light" onClick={() => navigate('/blog')}>
            ← Quay lại danh sách Blog
          </button>
        </div>
      </div>
    );
  }

  // Parse Content string and replace [product:id] tags with BlogProductCard components
  const renderParsedContent = (htmlContent) => {
    if (!htmlContent) return null;

    // Split HTML content by [product:id] placeholders
    const placeholderRegex = /\[product:(\d+)\]/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = placeholderRegex.exec(htmlContent)) !== null) {
      const pId = parseInt(match[1], 10);
      const textChunk = htmlContent.substring(lastIndex, match.index);

      if (textChunk) {
        parts.push(
          <div
            key={`html-${lastIndex}`}
            className="blog-html-chunk"
            dangerouslySetInnerHTML={{ __html: textChunk }}
          />
        );
      }

      parts.push(
        <div key={`product-${pId}-${match.index}`} className="blog-embedded-product-wrap">
          <BlogProductCard productId={pId} blogPostId={post.id} source={source} />
        </div>
      );

      lastIndex = placeholderRegex.lastIndex;
    }

    const remainingText = htmlContent.substring(lastIndex);
    if (remainingText) {
      parts.push(
        <div
          key={`html-${lastIndex}`}
          className="blog-html-chunk"
          dangerouslySetInnerHTML={{ __html: remainingText }}
        />
      );
    }

    return parts;
  };

  return (
    <article className="blog-detail-page">
      <div className="blog-detail-header">
        <div className="blog-detail-breadcrumbs">
          <span onClick={() => navigate('/blog')}>Blog</span> /{' '}
          <span>{post.categoryName || 'Tất cả'}</span>
        </div>

        <h1 className="blog-detail-title">{post.title}</h1>

        <div className="blog-detail-meta">
          <span>Tác giả: <strong>{post.authorName || 'Admin'}</strong></span>
          <span>•</span>
          <span>
            {post.publishedAt
              ? new Date(post.publishedAt).toLocaleDateString('vi-VN', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })
              : ''}
          </span>
        </div>

        {post.summary && <p className="blog-detail-summary">{post.summary}</p>}

        {post.thumbnail && (
          <div className="blog-detail-main-image">
            <img src={post.thumbnail} alt={post.title} />
          </div>
        )}
      </div>

      {/* Main Content Body */}
      <div className="blog-detail-body">
        {renderParsedContent(post.content)}
      </div>

      {/* Attached Related Products Section */}
      {post.products && post.products.length > 0 && (
        <section className="blog-related-products-section">
          <h3>Sản phẩm đề xuất trong bài viết</h3>
          <div className="blog-related-products-grid">
            {post.products.map((p) => (
              <BlogProductCard
                key={p.productId}
                productId={p.productId}
                blogPostId={post.id}
                source={source}
              />
            ))}
          </div>
        </section>
      )}

      <div className="blog-detail-footer">
        <button type="button" className="bob-btn-light" onClick={() => navigate('/blog')}>
          ← Xem các bài viết khác
        </button>
      </div>
    </article>
  );
}
