import {resolve} from 'path';

import type {AliasOptions} from 'vite';
import {defineConfig} from 'vite';

const resolvePath = (path: string) => resolve(__dirname, path);

export const alias: AliasOptions = {
  '@shopify/core': resolvePath('./packages/core/src/'),
};

export default defineConfig({
  optimizeDeps: {
    entries: [],
  },
  resolve: {
    alias,
  },
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  test: {
    isolate: false,
    clearMocks: true,
  },
});
