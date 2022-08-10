import {defineConfig} from 'vite'
import reactRefresh from '@vitejs/plugin-react-refresh'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [reactRefresh()],
  build: {
    outDir: '../ui-extensions-go-cli/api/dev-console',
    assetsDir: 'extensions/dev-console/assets',
  },
  resolve: {
    alias: {
      // vite.config.ts, tsconfig.json, and jest.config.ts all need to define their own aliases
      '@': path.resolve(__dirname, './src'),
      '@shopify/ui-extensions-server-kit': path.resolve(__dirname, '../ui-extensions-server-kit/src'),
    },
  },
})
