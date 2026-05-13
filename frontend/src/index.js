import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; // Import file App.js ngay cùng cấp
import './App.css'; // Đường dẫn vào folder styles

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);