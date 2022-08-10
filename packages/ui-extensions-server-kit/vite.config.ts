import path from 'path';

import {defineConfig} from 'vite';
import reactRefresh from '@vitejs/plugin-react-refresh';

import {createEntryFiles} from './scripts/createEntryFiles';

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    outDir: './dist',
    lib: {
      name: 'UIExtensionsServerKit',
      entry: path.join(process.cwd(), 'src/index.ts'),
      formats: ['cjs', 'es'],
      fileName: (type) => `index.${type}.js`,
    },
    rollupOptions: {
      external: ['react'],
      input: {
        index: path.join(process.cwd(), 'src/index.ts'),
        testing: path.join(process.cwd(), 'src/testing/index.ts'),
      },
      output: {
        globals: {
          react: 'React',
        },
        preserveModules: true,
        assetFileNames: `[name].[ext]`,
        entryFileNames: ({facadeModuleId}) => {
          return facadeModuleId.endsWith('testing/index.ts')
            ? 'index.[format].js'
            : '[name].[format].js';
        },
      },
    },
  },

  plugins: [
    reactRefresh(),
    createEntryFiles({
      files: {
        index: './dist/index',
        testing: './dist/testing/index',
      },
    }),
  ],
});
