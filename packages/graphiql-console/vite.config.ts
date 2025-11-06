import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import {createRequire} from 'module'
import path from 'path'

const require = createRequire(import.meta.url)
const monacoEditorPlugin = require('vite-plugin-monaco-editor').default

export default defineConfig({
  plugins: [
    react(),
    monacoEditorPlugin({
      languageWorkers: ['editorWorkerService', 'json', 'typescript'],
    }),
  ],
  build: {
    outDir: '../app/assets/graphiql',
    assetsDir: 'extensions/graphiql/assets',
    emptyOutDir: true,
  },
  worker: {
    format: 'es',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      tests: path.resolve(__dirname, './tests'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [path.resolve(__dirname, './tests/setup.ts')],
    deps: {
      inline: ['@shopify/react-testing'],
    },
  },
})
