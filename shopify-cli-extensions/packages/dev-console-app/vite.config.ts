import path from 'path';

import {defineConfig} from 'vite';
import reactRefresh from '@vitejs/plugin-react-refresh';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [reactRefresh()],
  build: {
    outDir: '../../api/dev-console-app',
  },
  resolve: {
    alias: {
      // vite.config.ts, tsconfig.json, and jest.config.ts all need to define their own aliases
      '@': path.resolve(__dirname, './src'),
      '@shopify/ui-extensions-dev-console': path.resolve(__dirname, '../dev-console/src'),
    },
  },
});
