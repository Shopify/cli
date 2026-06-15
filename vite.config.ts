import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    env: {
      SHOPIFY_CLI_ENV: 'development',
    },
    coverage: {
      provider: 'istanbul',
    },
    projects: [
      'packages/app/vite.config.ts',
      'packages/cli/vite.config.ts',
      'packages/cli-kit/vite.config.ts',
      'packages/organizations/vite.config.ts',
      'packages/plugin-cloudflare/vite.config.ts',
      'packages/plugin-did-you-mean/vite.config.ts',
      'packages/store/vite.config.ts',
      'packages/theme/vite.config.ts',
      'packages/ui-extensions-dev-console/vite.config.mts',
      'packages/ui-extensions-server-kit/vite.config.mts',
    ],
  },
})
