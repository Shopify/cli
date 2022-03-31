import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    outDir: 'dist/app',
    emptyOutDir: false,
    sourcemap: true,
    watch: process.env.DEV ? {} : undefined,
    minify: process.env.DEV ? false : 'esbuild',
  },
  plugins: [react()],
  resolve: {
    alias: {
      app: path.resolve(__dirname, './src'),
    },
  },
})
