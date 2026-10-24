import { defineConfig } from 'vite';
export default defineConfig({ build: { target: 'es2020', cssMinify: true }, server: { host: '127.0.0.1' } });
