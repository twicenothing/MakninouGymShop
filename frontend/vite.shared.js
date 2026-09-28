import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const base = fileURLToPath(new URL('.', import.meta.url));
export const appConfig = (name, port) => defineConfig(({ mode }) => {
  const env = loadEnv(mode, base, '');
  return {
    root: `${base}apps/${name}`,
    envDir: base,
    publicDir: `${base}public`,
    plugins: [react()],
    server: {
      host: '127.0.0.1', port, strictPort: true,
      fs: { allow: [base] },
      proxy: {
        '/api': { target: env.API_TARGET || 'https://localhost:7047', changeOrigin: true,
          secure: false, rewrite: path => path.replace(/^\/api/, '') },
        '/uploads': { target: env.API_TARGET || 'https://localhost:7047', changeOrigin: true, secure: false }
      }
    },
    build: { outDir: `${base}dist/${name}`, emptyOutDir: true }
  };
});
