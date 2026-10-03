import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import Management from './index';

// 独立演示：不加载平台 SDK、全局主题或业务 API。
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        <Route path="management/*" element={<Management />} />
        <Route path="*" element={<Navigate to="/management" replace />} />
      </Routes>
    </HashRouter>
  </React.StrictMode>,
);
