import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    // WalletConnect deps reference Node.js globals — polyfill for browser
    global: 'globalThis',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    // Allow Discord's iframe to embed this during development
    headers: {
      'Content-Security-Policy':
        "frame-ancestors https://discord.com https://*.discord.com https://*.discordapp.com https://*.discordsays.com",
    },
  },
});
