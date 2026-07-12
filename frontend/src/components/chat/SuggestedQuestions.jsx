import React from 'react';
import '../../styles/SuggestedQuestions.css';

const SUGGESTIONS = [
  "Sản phẩm này có những màu nào?",
  "Còn size M không shop?",
  "Phí ship như thế nào?",
  "Chính sách đổi trả ra sao?",
  "Có đang được khuyến mãi không?"
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
        >
          {q}
        </button>
      ))}
    </div>
  );
}
