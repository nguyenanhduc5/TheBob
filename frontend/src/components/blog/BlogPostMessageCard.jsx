import React from 'react';
import { useNavigate } from 'react-router-dom';
import { blogAPI } from '../../api/app';

export default function BlogPostMessageCard({ message }) {
  const navigate = useNavigate();

  let metadata = null;
  if (message.metadata) {
    try {
      metadata = typeof message.metadata === 'string' ? JSON.parse(message.metadata) : message.metadata;
    } catch {
      metadata = null;
    }
  }

  const title = metadata?.title || message.content?.replace(/^\[Bài viết\]\s*/, '') || 'Bài viết từ THEBOB';
  const summary = metadata?.summary || 'Bấm vào bên dưới để xem chi tiết bài viết...';
  const thumbnail = metadata?.thumbnail || '/placeholder.jpg';
  const slug = metadata?.slug;

  const handleNavigate = (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Fire-and-forget click tracking with source = 'Chat'
    if (message.referenceId) {
      blogAPI.trackClick(message.referenceId, 'Chat').catch(() => {});
    }

    if (slug) {
      navigate(`/blog/${slug}`);
    } else if (message.referenceId) {
      navigate(`/blog/post-${message.referenceId}`);
    }
  };

  return (
    <div className="chat-blog-card" onClick={handleNavigate}>
      <div className="chat-blog-card__header">
        <span className="chat-blog-card__badge">📝 BÀI VIẾT TỪ THEBOB</span>
      </div>
      <div className="chat-blog-card__body">
        {thumbnail && (
          <div className="chat-blog-card__image-wrap">
            <img src={thumbnail} alt={title} className="chat-blog-card__image" />
          </div>
        )}
        <div className="chat-blog-card__content">
          <h4 className="chat-blog-card__title">{title}</h4>
          <p className="chat-blog-card__summary">{summary}</p>
        </div>
      </div>
      <div className="chat-blog-card__footer">
        <button
          type="button"
          className="chat-blog-card__btn"
          onClick={handleNavigate}
        >
          Đọc bài viết →
        </button>
      </div>
    </div>
  );
}
