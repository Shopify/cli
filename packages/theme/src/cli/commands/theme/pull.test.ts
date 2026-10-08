import Pull from './pull.js'
import {executeThemePull} from '../../services/pull.js'
import {themePullJsonOutputSchema} from '../../services/pull/types.js'
import {withCapturedStandardStreams} from '@shopify/cli-kit/node/testing/output'
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

  test('exposes the schema in help and retains JSON and inherited flags', () => {
    expect(Pull.jsonOutputSchema).toBe(themePullJsonOutputSchema)
    expect(Pull.description).toContain('ThemePullResult')
    expect(Pull.flags.json).toBeDefined()
    expect(Pull.baseFlags).toHaveProperty('json-schema')
  })

  test('executes and writes the result through the real encoder', async () => {
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
      path: '/theme',
    })
    const command = new Pull([], new Config({root: '.'}))
    await withCapturedStandardStreams(async ({stdout, stderr}) => {
      await command.command({json: true} as never, session, false)

      expect(JSON.parse(stdout())).toMatchObject({
        status: 'success',
        changed: true,
        directory: nativePath('/theme'),
        theme: {id: '1', storeDomain: session.storeFqdn, sourceUrl: null},
      })
      expect(stderr()).toBe('')
    })
  })

  test('retains cancellation without emitting a success result', async () => {
    vi.mocked(executeThemePull).mockResolvedValue(undefined)
    const command = new Pull([], new Config({root: '.'}))
    await withCapturedStandardStreams(async ({stdout}) => {
      await command.command({json: true} as never, session, false)

      expect(JSON.parse(stdout())).toEqual({status: 'cancelled'})
    })
  })

  test('propagates download failures without writing a result', async () => {
    const failure = new AbortError('download failed')
    vi.mocked(executeThemePull).mockRejectedValueOnce(failure)
    const command = new Pull([], new Config({root: '.'}))
    await withCapturedStandardStreams(async ({stdout}) => {
      await expect(command.command({json: true} as never, session, false)).rejects.toBe(failure)

      expect(stdout()).toBe('')
    })
  })
})
