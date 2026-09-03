import { defineConfig } from 'vite';

// base: './' — 资源用相对路径引用,部署在域名根目录或任意子路径(如 /mc/)均可直接运行
export default defineConfig({
  base: './',
});
