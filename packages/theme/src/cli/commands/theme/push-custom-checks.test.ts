import Push from './push.js'
import {executeThemePush} from '../../services/push.js'
import {afterEach, expect, test, vi} from 'vitest'
import {Config} from '@oclif/core'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {inTemporaryDirectory, mkdir, writeFile, fileExists} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'

vi.mock('../../services/push.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/push.js')>()),
  executeThemePush: vi.fn(),
}))
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/store-auth-session')

afterEach(() => vi.unstubAllEnvs())

async function writeCustomCheck(directory: string) {
  await mkdir(joinPath(directory, 'templates'))
  await writeFile(joinPath(directory, 'templates/index.liquid'), '<p>Example</p>')
  await writeFile(
    joinPath(directory, '.theme-check.yml'),
    'extends: []\nrequire:\n  - ./theme-checks.cjs\nCustomPushError:\n  enabled: true\n',
  )
  await writeFile(
    joinPath(directory, 'theme-checks.cjs'),
    `require('node:fs').writeFileSync(require('node:path').join(__dirname, 'custom-check-loaded'), 'loaded')
exports.checks = [{
  meta: {
    code: 'CustomPushError',
    name: 'Custom push error',
    docs: {description: 'Reports an error to prevent pushing.'},
    type: 'LiquidHtml',
    severity: 0,
    schema: {},
  },
  create(context) {
    return {
      onCodePathEnd() {
        context.report({message: 'Custom check blocks the push.', startIndex: 0, endIndex: 1})
      },
    }
  },
}]
`,
  )
}

async function command(directory: string, argv: string[]) {
  const config = new Config({root: __dirname})
  await config.load()
  return new Push(
    [`--path=${directory}`, '--store=test.myshopify.com', '--theme=1', '--json', '--no-input', ...argv],
    config,
  )
}

test.each([
  {argv: ['--strict'], environment: undefined, allowed: false},
  {argv: ['--strict', '--allow-custom-checks'], environment: undefined, allowed: true},
  {argv: ['--strict'], environment: '1', allowed: true},
  {argv: ['--strict', '--no-allow-custom-checks'], environment: '1', allowed: false},
  {argv: ['--strict'], environment: undefined, configuredConsent: true, allowed: false},
  {argv: ['--strict', '--no-allow-custom-checks'], environment: '1', configuredConsent: true, allowed: false},
  {argv: [], environment: undefined, allowed: false},
  {argv: [], environment: '0', allowed: false},
  {argv: ['--no-allow-custom-checks'], environment: '1', allowed: false},
])(
  'push honors operator consent: $argv / $environment / TOML=$configuredConsent',
  async ({argv, environment, configuredConsent, allowed}) => {
    vi.stubEnv('SHOPIFY_FLAG_ALLOW_CUSTOM_CHECKS', environment)
    vi.mocked(ensureAuthenticatedThemes).mockResolvedValue({storeFqdn: 'test.myshopify.com', token: 'token'})
    await inTemporaryDirectory(async (directory) => {
      await writeCustomCheck(directory)
      if (configuredConsent) {
        await writeFile(
          joinPath(directory, 'shopify.theme.toml'),
          '[environments.default]\nallow-custom-checks = true\n',
        )
      }
      const push = await command(directory, argv)
      await withCapturedStandardStreams(async ({stdout, stderr}) => {
        if (allowed) {
          await expect(push.run()).rejects.toThrow('Theme check failed. Please fix the errors before pushing.')
          expect(executeThemePush).not.toHaveBeenCalled()
          expect(stderr()).toContain('Custom check blocks the push.')
          expect(stdout()).toBe('')
        } else {
          await push.run()
          expect(executeThemePush).toHaveBeenCalledOnce()
          if (configuredConsent) {
            expect(executeThemePush).toHaveBeenCalledWith(
              expect.objectContaining({'allow-custom-checks': !argv.includes('--no-allow-custom-checks')}),
              expect.anything(),
              false,
              undefined,
            )
          }
        }
      })
      await expect(fileExists(joinPath(directory, 'custom-check-loaded'))).resolves.toBe(allowed)
    })
  },
)

test.each([
  {argv: ['--allow-custom-checks'], environment: undefined},
  {argv: [], environment: '1'},
])('requires strict before authentication or upload: $argv / $environment', async ({argv, environment}) => {
  vi.stubEnv('SHOPIFY_FLAG_ALLOW_CUSTOM_CHECKS', environment)
  await inTemporaryDirectory(async (directory) => {
    await writeCustomCheck(directory)
    const push = await command(directory, argv)
    await withCapturedStandardStreams(async () => {
      await expect(push.run()).rejects.toThrow(
        'The --allow-custom-checks flag requires --strict when using theme push.',
      )
    })
    expect(ensureAuthenticatedThemes).not.toHaveBeenCalled()
    expect(executeThemePush).not.toHaveBeenCalled()
    await expect(fileExists(joinPath(directory, 'custom-check-loaded'))).resolves.toBe(false)
  })
})
