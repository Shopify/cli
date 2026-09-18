import {resolveAppDoctorContext} from './app-doctor-context.js'
import {AppLocalStorageSchema, setCachedAppInfo} from './local-storage.js'
import {
  inCanonicalTemporaryDirectory,
  linkedConfiguration,
  makeFixtureDirectory,
  writeFixtureFile,
} from './app-doctor-engine/tests/context-test-helpers.js'
import {describe, expect, test, vi} from 'vitest'
import {AbortError} from '@shopify/cli-kit/node/error'
import {LocalStorage} from '@shopify/cli-kit/node/local-storage'
import {joinPath} from '@shopify/cli-kit/node/path'
import {renderSelectPrompt} from '@shopify/cli-kit/node/ui'

vi.mock('@shopify/cli-kit/node/ui')

const appStorage = (cwd: string) => new LocalStorage<AppLocalStorageSchema>({cwd})

/** Snapshot of every stored app entry, used to assert the cache is never written. */
const storedEntries = (storage: LocalStorage<AppLocalStorageSchema>, directories: string[]) =>
  directories.map((directory) => storage.get(directory))

describe('resolveAppDoctorContext', () => {
  test('resolves the containing app without prompting or touching the cache', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const configurationPath = await writeFixtureFile(root, 'app/shopify.app.toml', linkedConfiguration('id-1'))
      const storage = appStorage(await makeFixtureDirectory(root, 'storage'))

      const context = await resolveAppDoctorContext({
        directory: joinPath(root, 'app'),
        interactive: true,
        appStorage: storage,
      })

      expect(context).toMatchObject({
        appRoot: joinPath(root, 'app'),
        configurationPath,
        clientId: 'id-1',
        selectionSource: 'default',
      })
      expect(renderSelectPrompt).not.toHaveBeenCalled()
      expect(storedEntries(storage, [joinPath(root, 'app')])).toEqual([undefined])
    })
  })

  test('prompts once for the app when interactive and several apps are found', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      await writeFixtureFile(root, 'apps/a/shopify.app.toml')
      const chosen = await writeFixtureFile(root, 'apps/b/shopify.app.toml')
      vi.mocked(renderSelectPrompt).mockResolvedValueOnce(joinPath(root, 'apps/b'))

      const context = await resolveAppDoctorContext({directory: root, interactive: true, appStorage: appStorage(root)})

      expect(context.configurationPath).toBe(chosen)
      expect(context.selectionSource).toBe('default')
      expect(renderSelectPrompt).toHaveBeenCalledTimes(1)
      expect(renderSelectPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          choices: [
            {label: joinPath(root, 'apps/a'), value: joinPath(root, 'apps/a')},
            {label: joinPath(root, 'apps/b'), value: joinPath(root, 'apps/b')},
          ],
        }),
      )
    })
  })

  test('fails actionably when several apps are found and the terminal is not interactive', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      await writeFixtureFile(root, 'apps/a/shopify.app.toml')
      await writeFixtureFile(root, 'apps/b/shopify.app.toml')

      const result = resolveAppDoctorContext({directory: root, interactive: false, appStorage: appStorage(root)})

      await expect(result).rejects.toBeInstanceOf(AbortError)
      await expect(result).rejects.toThrowError(
        new RegExp(`${joinPath(root, 'apps/a')}[\\s\\S]*${joinPath(root, 'apps/b')}`),
      )
      await expect(result).rejects.toMatchObject({tryMessage: expect.stringContaining('--path')})
      expect(renderSelectPrompt).not.toHaveBeenCalled()
    })
  })

  test('honours a cached configuration preference read from the injected storage', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const app = joinPath(root, 'app')
      await writeFixtureFile(app, 'shopify.app.toml')
      const staging = await writeFixtureFile(app, 'shopify.app.staging.toml')
      const storage = appStorage(await makeFixtureDirectory(root, 'storage'))
      setCachedAppInfo({directory: app, configFile: 'shopify.app.staging.toml'}, storage)
      const before = storedEntries(storage, [app])

      const context = await resolveAppDoctorContext({directory: app, interactive: false, appStorage: storage})

      expect(context).toMatchObject({configurationPath: staging, selectionSource: 'cached'})
      expect(storedEntries(storage, [app])).toEqual(before)
    })
  })

  test('prompts once for the configuration on an interactive stale cache and never rewrites the cache', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const app = joinPath(root, 'app')
      await writeFixtureFile(app, 'shopify.app.toml')
      const production = await writeFixtureFile(app, 'shopify.app.production.toml')
      const storage = appStorage(await makeFixtureDirectory(root, 'storage'))
      setCachedAppInfo({directory: app, configFile: 'shopify.app.gone.toml'}, storage)
      const before = storedEntries(storage, [app])
      vi.mocked(renderSelectPrompt).mockResolvedValueOnce('shopify.app.production.toml')

      const context = await resolveAppDoctorContext({directory: app, interactive: true, appStorage: storage})

      expect(context).toMatchObject({configurationPath: production, selectionSource: 'prompt'})
      expect(renderSelectPrompt).toHaveBeenCalledTimes(1)
      expect(renderSelectPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          choices: [
            {label: 'shopify.app.production.toml', value: 'shopify.app.production.toml'},
            {label: 'shopify.app.toml', value: 'shopify.app.toml'},
          ],
        }),
      )
      expect(storedEntries(storage, [app])).toEqual(before)
    })
  })

  test('uses the default configuration on a non-interactive stale cache', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const app = joinPath(root, 'app')
      const defaultPath = await writeFixtureFile(app, 'shopify.app.toml')
      await writeFixtureFile(app, 'shopify.app.production.toml')
      const storage = appStorage(await makeFixtureDirectory(root, 'storage'))
      setCachedAppInfo({directory: app, configFile: 'shopify.app.gone.toml'}, storage)

      const context = await resolveAppDoctorContext({directory: app, interactive: false, appStorage: storage})

      expect(context).toMatchObject({configurationPath: defaultPath, selectionSource: 'default'})
      expect(renderSelectPrompt).not.toHaveBeenCalled()
    })
  })

  test('selects an explicit configuration file and passes selectors through', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      await writeFixtureFile(root, 'app/shopify.app.toml')
      const staging = await writeFixtureFile(root, 'app/shopify.app.staging.toml', linkedConfiguration('staging-id'))

      const byFile = await resolveAppDoctorContext({
        directory: staging,
        interactive: false,
        appStorage: appStorage(root),
      })
      expect(byFile).toMatchObject({configurationPath: staging, selectionSource: 'file'})

      const byName = await resolveAppDoctorContext({
        directory: joinPath(root, 'app'),
        configName: 'staging',
        interactive: false,
        appStorage: appStorage(root),
      })
      expect(byName).toMatchObject({configurationPath: staging, selectionSource: 'config'})

      const byClientId = await resolveAppDoctorContext({
        directory: joinPath(root, 'app'),
        clientId: 'staging-id',
        interactive: false,
        appStorage: appStorage(root),
      })
      expect(byClientId).toMatchObject({configurationPath: staging, selectionSource: 'client-id'})
    })
  })

  test('matches --client-id against the stored client ID verbatim, whitespace included', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      await writeFixtureFile(root, 'app/shopify.app.toml')
      const padded = await writeFixtureFile(root, 'app/shopify.app.padded.toml', linkedConfiguration(' padded '))

      const exact = await resolveAppDoctorContext({
        directory: joinPath(root, 'app'),
        clientId: ' padded ',
        interactive: false,
        appStorage: appStorage(root),
      })
      expect(exact).toMatchObject({configurationPath: padded, clientId: ' padded ', selectionSource: 'client-id'})

      const trimmed = resolveAppDoctorContext({
        directory: joinPath(root, 'app'),
        clientId: 'padded',
        interactive: false,
        appStorage: appStorage(root),
      })
      await expect(trimmed).rejects.toBeInstanceOf(AbortError)
      await expect(trimmed).rejects.toMatchObject({tryMessage: expect.stringContaining('--config')})
    })
  })

  test('maps engine errors to AbortError with their message', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      await writeFixtureFile(root, 'app/shopify.app.toml')
      const missingName = resolveAppDoctorContext({
        directory: joinPath(root, 'app'),
        configName: 'missing',
        interactive: false,
        appStorage: appStorage(root),
      })
      await expect(missingName).rejects.toBeInstanceOf(AbortError)
      await expect(missingName).rejects.toThrowError(/shopify\.app\.missing\.toml/)

      const conflict = resolveAppDoctorContext({
        directory: joinPath(root, 'app'),
        configName: 'a',
        clientId: 'b',
        interactive: true,
        appStorage: appStorage(root),
      })
      await expect(conflict).rejects.toBeInstanceOf(AbortError)

      const nowhere = resolveAppDoctorContext({
        directory: joinPath(root, 'nowhere'),
        interactive: true,
        appStorage: appStorage(root),
      })
      await expect(nowhere).rejects.toBeInstanceOf(AbortError)
      expect(renderSelectPrompt).not.toHaveBeenCalled()
    })
  })
})
