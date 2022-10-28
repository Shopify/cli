import {defineConfig} from 'vite'
import reactRefresh from '@vitejs/plugin-react-refresh'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [reactRefresh()],
  build: {
    outDir: '../app/assets/dev-console',
    assetsDir: 'extensions/dev-console/assets',
  },
  resolve: {
    alias: {
      // vite.config.ts, tsconfig.json, and jest.config.ts all need to define their own aliases
      '@': path.resolve(__dirname, './src'),
      '@shopify/ui-extensions-server-kit': path.resolve(__dirname, '../ui-extensions-server-kit/src'),
      tests: path.resolve(__dirname, './tests'),
      '@shopify/ui-extensions-test-utils': path.resolve(__dirname, '../ui-extensions-test-utils/src'),
      '@shopify/ui-extensions-server-kit/testing': path.resolve(__dirname, '../ui-extensions-server-kit/src/testing'),
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
