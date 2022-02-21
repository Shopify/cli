import path from 'path';

import {defineConfig} from 'vite';

import {plugins} from './rollup.config';

const aliases = {
  '@shopify/cli-kit': path.join(__dirname, '../packages/cli-kit/src/index.ts'),
  '@shopify/cli-testing': path.join(
    __dirname,
    '../packages/cli-testing/src/index.ts',
  ),
};

export default function config(packagePath) {
  return defineConfig({
    build: {
      rollupOptions: {
        plugins: plugins(packagePath, aliases),
      },
    },
    optimizeDeps: {
      entries: [],
    },
    resolve: {
      alias: aliases,
    },
    // @ts-ignore
    test: {
      isolate: false,
      clearMocks: true,
      setupFiles: [path.join(__dirname, './vitest.setup.js')],
    },
  });
}
