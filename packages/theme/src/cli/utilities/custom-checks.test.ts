import {customCheckOptions} from './custom-checks.js'
import {afterEach, expect, test, vi} from 'vitest'

afterEach(() => vi.unstubAllEnvs())

test.each([
  {argv: [], environment: undefined, allowed: false},
  {argv: ['--allow-custom-checks'], environment: undefined, allowed: true},
  {argv: [], environment: '1', allowed: true},
  {argv: [], environment: 'true', allowed: true},
  {argv: [], environment: '0', allowed: false},
  {argv: ['--no-allow-custom-checks'], environment: '1', allowed: false},
  {argv: ['--', '--allow-custom-checks'], environment: undefined, allowed: false},
  {argv: ['--config=--allow-custom-checks'], environment: undefined, allowed: false},
])('authorizes only operator input: $argv / $environment', async ({argv, environment, allowed}) => {
  vi.stubEnv('SHOPIFY_FLAG_ALLOW_CUSTOM_CHECKS', environment)
  const {authorizeCustomChecks} = await customCheckOptions(argv)
  await expect(Promise.resolve(authorizeCustomChecks?.({root: '/theme', candidates: []}))).resolves.toBe(allowed)
})
