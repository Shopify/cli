import { defineConfig } from "vite";
import path from "path";

// prettier-ignore
const INDEX_ROUTE = "^/(\\?.*)?$";
const API_ROUTE = "^/api/";

const root = new URL(".", import.meta.url).pathname;
export default defineConfig({
  root,
  define: {
    "process.env.SHOPIFY_API_KEY": JSON.stringify(process.env.SHOPIFY_API_KEY),
  },
  esbuild: {
    jsxInject: `import React from 'react'`,
  },
  resolve: {
    alias: {
      assets: path.resolve(root, "./assets"),
      components: path.resolve(root, "./components"),
      pages: path.resolve(root, "./pages"),
    },
  },
  server: {
    port: process.env.FRONTEND_PORT,
    middlewareMode: "html",
    hmr: {
      protocol: "ws",
      host: "localhost",
      port: 64999,
      clientPort: 64999,
    },
    proxy: {
      [INDEX_ROUTE]: {
        target: `http://127.0.0.1:${process.env.BACKEND_PORT}`,
        changeOrigin: false,
        secure: true,
        ws: false,
      },
      [API_ROUTE]: {
        target: `http://127.0.0.1:${process.env.BACKEND_PORT}`,
        changeOrigin: false,
        secure: true,
        ws: false,
      },
    },
  },
});
