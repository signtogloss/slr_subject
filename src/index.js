import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';
import './modern-styles.css'; // 引入现代化样式
// animations.css已移除，不再需要动画效果
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
// i18n配置已移除，只使用英文

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  // <React.StrictMode>
    <App />
  // </React.StrictMode>
);
