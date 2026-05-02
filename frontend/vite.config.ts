import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import fs from 'fs';

const certDir = path.resolve(__dirname, 'certs');
const certKeyPath = path.join(certDir, '192.168.178.46+2-key.pem');
const certPath = path.join(certDir, '192.168.178.46+2.pem');

function localHttpsConfig() {
  if (!fs.existsSync(certKeyPath) || !fs.existsSync(certPath)) return undefined;
  return {
    key: fs.readFileSync(certKeyPath),
    cert: fs.readFileSync(certPath),
  };
}

const https = localHttpsConfig();

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    ...(https ? { https } : {}),
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 5175,
    ...(https ? { https } : {}),
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});
