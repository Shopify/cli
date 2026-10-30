import {setupDevServer} from './theme-environment.js'
import {pollRemoteJsonChanges} from './theme-polling.js'
import {reconcileJsonFiles} from './theme-reconciliation.js'
import {mountThemeFileSystem} from '../theme-fs.js'
import {emptyThemeExtFileSystem} from '../theme-fs-empty.js'
import {inTemporaryDirectory, mkdir, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {readDevInstance, withDevInstance} from '@shopify/cli-kit/node/dev-instance'
import {fetchChecksums, fetchThemeAssets} from '@shopify/cli-kit/node/themes/api'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'
import {expect, test, vi} from 'vitest'
import type {Checksum, ThemeAsset} from '@shopify/cli-kit/node/themes/types'

vi.mock('@shopify/cli-kit/node/themes/api')
vi.mock('../theme-uploader.js', () => ({
  uploadTheme: () => ({workPromise: Promise.resolve(), renderThemeSyncProgress: async () => {}}),
}))

const theme = buildTheme({id: 123, name: 'Development', role: 'development'})!
const session = {storeFqdn: 'fixture.myshopify.com', token: 'fixture', storefrontToken: '', sessionCookies: {}}

test('retains ownership until a pending poll stops and preserves a local edit', async () => {
  await inTemporaryDirectory(async (directory) => {
    await mkdir(joinPath(directory, 'templates'))
    const file = joinPath(directory, 'templates/index.json')
    await writeFile(file, '{}')
    const controller = new AbortController()
    const localThemeFileSystem = mountThemeFileSystem(directory, {signal: controller.signal})
    await localThemeFileSystem.ready()
    const checksums = [...localThemeFileSystem.files.values()]
    const {promise: requested, resolve: markRequested} = Promise.withResolvers<void>()
    const {promise: response, resolve: respond} = Promise.withResolvers<Checksum[]>()
    vi.mocked(fetchChecksums)
      .mockResolvedValueOnce(checksums)
      .mockResolvedValueOnce(checksums)
      .mockImplementationOnce(() => {
        markRequested()
        return response
      })
    const identity = {command: 'theme dev', directory, key: `${session.storeFqdn}:${theme.id}`}

    await withDevInstance(identity, async () => {
      const server = setupDevServer(theme, {
        signal: controller.signal,
        session,
        directory,
        localThemeFileSystem,
        localThemeExtensionFileSystem: emptyThemeExtFileSystem(),
        type: 'theme',
        lastRequestedPath: '',
        options: {
          themeEditorSync: true,
          host: '127.0.0.1',
          port: 9292,
          open: false,
          liveReload: 'off',
          standardEventsDevBundle: false,
          standardEventsInspector: false,
          noDelete: false,
          ignore: [],
          only: [],
          errorOverlay: 'default',
        },
      })
      try {
        await server.workPromise
        await requested
        await writeFile(file, '{"edited":true}')
        controller.abort()
        const stopped = vi.fn()
        const stopping = server.serverStop().then(stopped)
        await new Promise((resolve) => setImmediate(resolve))
        expect(stopped).not.toHaveBeenCalled()
        await expect(readDevInstance(identity)).resolves.toBeDefined()
        respond([])
        await stopping
        await expect(readFile(file)).resolves.toBe('{"edited":true}')
      } finally {
        controller.abort()
        respond([])
        await server.serverStop()
      }
    })

    await expect(readDevInstance(identity)).resolves.toBeUndefined()
  })
})

test.each(['polling', 'reconciliation'])(
  'preserves a local file when cancellation interrupts a %s asset request',
  async (source) => {
    await inTemporaryDirectory(async (directory) => {
      await mkdir(joinPath(directory, 'templates'))
      const file = joinPath(directory, 'templates/index.json')
      await writeFile(file, '{}')
      const localThemeFileSystem = mountThemeFileSystem(directory)
      await localThemeFileSystem.ready()
      const remoteChecksums = [...localThemeFileSystem.files.values()]
      const changedChecksums = [{key: 'templates/index.json', checksum: 'changed'}]
      const controller = new AbortController()
      const {promise: requested, resolve: markRequested} = Promise.withResolvers<void>()
      const {promise: response, resolve: respond} = Promise.withResolvers<ThemeAsset[]>()
      vi.mocked(fetchChecksums).mockResolvedValue(changedChecksums)
      vi.mocked(fetchThemeAssets).mockImplementationOnce(() => {
        markRequested()
        return response
      })
      const options = {
        noDelete: false,
        ignore: [],
        only: [],
        reconciliationStrategy: 'keep-remote' as const,
        signal: controller.signal,
      }
      const syncing =
        source === 'polling'
          ? pollRemoteJsonChanges(theme, session, remoteChecksums, localThemeFileSystem, options)
          : reconcileJsonFiles(theme, session, changedChecksums, localThemeFileSystem, options).then(
              ({workPromise}) => workPromise,
            )
      const cancelled = expect(syncing).rejects.toMatchObject({name: 'AbortError'})
      try {
        await requested
        controller.abort()
        await writeFile(file, '{"edited":true}')
        respond([{key: 'templates/index.json', checksum: 'changed', value: '{"remote":true}'}])
        await cancelled
        await expect(readFile(file)).resolves.toBe('{"edited":true}')
      } finally {
        controller.abort()
        respond([])
        await syncing.catch(() => {})
      }
    })
  },
)
