import { defineConfig } from 'vite';
import path from 'node:path';

// 纯本地 UI 预览；不加载 .env，不使用平台插件，不配置后端代理。
export default defineConfig({
  root: path.resolve(__dirname, 'client'),
  base: './',
  envDir: false,
  plugins: [{
    name: 'management-preview-entry',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url === '/' || request.url === '/index.html') {
          response.writeHead(302, { Location: '/management.html' });
          response.end();
          return;
        }
        next();
      });
    },
  }],
  optimizeDeps: { entries: ['management.html'] },
  css: { postcss: { plugins: [] } },
  server: { host: '127.0.0.1', port: 4173, strictPort: true, open: '/management.html' },
  build: {
    outDir: path.resolve(__dirname, 'dist-management'),
    emptyOutDir: true,
    rollupOptions: { input: path.resolve(__dirname, 'client/management.html') },
  },
});
