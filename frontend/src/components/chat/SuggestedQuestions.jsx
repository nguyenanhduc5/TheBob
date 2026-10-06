import React from 'react';
import '../../styles/SuggestedQuestions.css';

const SUGGESTIONS = [
  "Sản phẩm này có những màu nào?",
  "Còn size M không shop?",
  "SP nổi bật",
  "Đơn hàng của tôi"
];

export default function SuggestedQuestions({ onSelect }) {
  return (
    <div className="suggested-questions">
      {SUGGESTIONS.map((q, idx) => (
        <button 
          key={idx} 
          type="button" 
          className="suggested-questions__btn"
          onClick={() => onSelect(q)}
          aria-label={`Gửi gợi ý: ${q}`}
        >
          {q}
        </button>
      ))}
    </div>
  );
}
