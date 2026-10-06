import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { initAuth } from './store/authStore';

const root = ReactDOM.createRoot(document.getElementById('root')!);

// 서버에 로그인 상태를 먼저 확인한 뒤 화면을 그린다. (확인 전에 그리면 로그인 사용자가 잠깐 비로그인 화면이나 로그인 요구 화면을 보게 된다)
void initAuth().finally(() => {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
