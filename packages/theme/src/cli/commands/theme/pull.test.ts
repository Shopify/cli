import Pull from './pull.js'
import {executeThemePull} from '../../services/pull.js'
import {themeResultJsonSchema} from '../../services/json-output/schema.test-data.js'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
import {describeJsonCommand} from '@shopify/cli-kit/node/testing/json-command'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {describe, expect, test, vi} from 'vitest'
import {Config} from '@oclif/core'
import {AbortError} from '@shopify/cli-kit/node/error'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import * as pathUtilities from '@shopify/cli-kit/node/path'
// Native JSON paths must preserve Windows separators instead of pathe normalization.
// eslint-disable-next-line no-restricted-imports
import {resolve as nativePath} from 'node:path'

vi.mock('../../services/pull.js')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('../../utilities/theme-store.js', () => ({ensureThemeStore: ({store}: {store: string}) => store}))
const session = {storeFqdn: 'test.myshopify.com', token: 'token'}

describe('theme pull JSON', () => {
  test('uses the current directory for one named environment without a configured path', async () => {
    const previousExitCode = process.exitCode
    try {
      await inTemporaryDirectory(async (directory) => {
        await writeFile(
          joinPath(directory, 'shopify.theme.toml'),
          '[environments.staging]\nstore = "test.myshopify.com"\npassword = "token"\ntheme = "1"\n',
        )
        const cwdSpy = vi.spyOn(pathUtilities, 'cwd').mockReturnValue(directory)
        try {
          vi.mocked(ensureAuthenticatedThemes).mockResolvedValue(session)
          vi.mocked(executeThemePull).mockResolvedValue({
            theme: {
              id: 1,
              name: 'Theme',
              role: 'unpublished',
              processing: false,
              shop: session.storeFqdn,
              editor_url: 'https://test.myshopify.com/admin/themes/1/editor',
              preview_url: 'https://test.myshopify.com?preview_theme_id=1',
            },
            path: directory,
          })
          const config = new Config({root: __dirname})
          await config.load()
          const command = new Pull(['--json', '--force', '-e', 'staging'], config)

          await withCapturedStandardStreams(async ({stdout}) => {
            await command.run()

            expect(JSON.parse(stdout())).toMatchObject({
              environments: [{environment: 'staging', result: {directory: nativePath(directory), status: 'success'}}],
            })
          })
          expect(executeThemePull).toHaveBeenCalledWith(
            expect.objectContaining({path: directory, theme: '1'}),
            session,
            true,
            expect.anything(),
          )
        } finally {
          cwdSpy.mockRestore()
        }
      })
    } finally {
      // eslint-disable-next-line require-atomic-updates
      process.exitCode = previousExitCode
    }
  })

  test('retains cancellation without emitting a success result', async () => {
    vi.mocked(executeThemePull).mockResolvedValue(undefined)
    const command = new Pull([], new Config({root: '.'}))
    await withCapturedStandardStreams(async ({stdout}) => {
      await command.command({json: true} as never, session, false)

      expect(JSON.parse(stdout())).toEqual({status: 'cancelled'})
    })
  })
})

const pullResult = {
  theme: {
    id: 1,
    name: 'Theme',
    role: 'unpublished',
    processing: false,
    shop: session.storeFqdn,
    editor_url: 'https://test.myshopify.com/admin/themes/1/editor',
    preview_url: 'https://test.myshopify.com?preview_theme_id=1',
  },
  path: '/theme',
}

describeJsonCommand({
  command: Pull,
  commandId: 'theme:pull',
  moduleURL: new URL('../../../../../cli/src/index.ts', import.meta.url).href,
  args: ['--store', session.storeFqdn, '--password', 'token', '--theme', '1'],
  expectedResult: {
    status: 'success',
    changed: true,
    directory: nativePath('/theme'),
    theme: {
      id: '1',
      name: 'Theme',
      role: 'unpublished',
      storeDomain: session.storeFqdn,
      previewUrl: 'https://test.myshopify.com?preview_theme_id=1',
      editorUrl: 'https://test.myshopify.com/admin/themes/1/editor',
      processing: false,
      sourceUrl: null,
    },
  },
  expectedSchema: themeResultJsonSchema,
  setup: () => {
    vi.mocked(ensureAuthenticatedThemes).mockResolvedValue(session)
    vi.mocked(executeThemePull).mockResolvedValue(pullResult)
  },
  assertExecuted: (format) => {
    expect(ensureAuthenticatedThemes).toHaveBeenCalledExactlyOnceWith(session.storeFqdn, 'token')
    expect(executeThemePull).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({store: session.storeFqdn, password: 'token', theme: '1', json: format === 'json'}),
      session,
      false,
      undefined,
    )
  },
  assertNotExecuted: () => {
    expect(ensureAuthenticatedThemes).not.toHaveBeenCalled()
    expect(executeThemePull).not.toHaveBeenCalled()
  },
  textOutput: ({stdout, stderr}) => {
    expect(stdout).toBe('')
    expect(stderr).toContain("The theme 'Theme' (#1) has been pulled.")
  },
  diagnostics: {
    setup: () => {
      vi.mocked(executeThemePull).mockImplementation(async () => {
        outputInfo('Downloading theme files')
        return pullResult
      })
    },
    expectedEvents: [{type: 'diagnostic', level: 'info', message: 'Downloading theme files'}],
  },
  failure: {
    setup: () => {
      vi.mocked(executeThemePull).mockRejectedValue(new AbortError('Download failed.'))
    },
    expectedError: {error: {type: 'abort', message: 'Download failed.'}},
    exitCode: 1,
  },
})
