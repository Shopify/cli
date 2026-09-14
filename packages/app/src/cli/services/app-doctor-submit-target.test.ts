import {resolveDoctorSubmitClientId} from './app-doctor-submit-target.js'
import {getCachedAppInfo} from './local-storage.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileExists, inTemporaryDirectory, readFile, readdir, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {TomlFile} from '@shopify/cli-kit/node/toml/toml-file'

vi.mock('./local-storage.js', () => ({getCachedAppInfo: vi.fn()}))

beforeEach(() => {
  vi.mocked(getCachedAppInfo).mockReset()
})

describe('resolveDoctorSubmitClientId', () => {
  test.each(['client_id = [', undefined])('uses an explicit client ID without loading config %s', async (content) => {
    await inTemporaryDirectory(async (directory) => {
      if (content !== undefined) await writeFile(joinPath(directory, 'shopify.app.toml'), content)

      await expect(resolveDoctorSubmitClientId({directory, clientId: 'explicit-client-id'})).resolves.toBe(
        'explicit-client-id',
      )
      expect(getCachedAppInfo).not.toHaveBeenCalled()
    })
  })

  test('reads the default linked config without requiring a complete app', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeFile(joinPath(directory, 'shopify.app.toml'), 'client_id = "default-client-id"')
      await writeFile(joinPath(directory, 'shopify.app.other.toml'), 'invalid = [')

      await expect(resolveDoctorSubmitClientId({directory})).resolves.toBe('default-client-id')
      expect(getCachedAppInfo).toHaveBeenCalledWith(directory)
    })
  })

  test.each(['', ' \t '])(
    'rejects a blank explicit client ID (%j) without falling back to config',
    async (clientId) => {
      await inTemporaryDirectory(async (directory) => {
        await writeFile(joinPath(directory, 'shopify.app.toml'), 'client_id = "default-client-id"')

        const error = await resolveDoctorSubmitClientId({directory, clientId}).catch((error: unknown) => error)

        expect(error).toBeInstanceOf(AbortError)
        expect(error).toMatchObject({
          message: expect.stringMatching(/--client-id.*non-empty/),
          nextSteps: [expect.stringContaining('--client-id <client-id>')],
        })
        expect(getCachedAppInfo).not.toHaveBeenCalled()
      })
    },
  )

  test.each(['production-eu', 'shopify.app.production-eu.toml', 'Production EU'])(
    'canonicalizes the config name %s and reads only the selected named file',
    async (configName) => {
      await inTemporaryDirectory(async (directory) => {
        await writeFile(joinPath(directory, 'shopify.app.toml'), 'client_id = "default-client-id"')
        await writeFile(joinPath(directory, 'shopify.app.production-eu.toml'), 'client_id = "named-client-id"')

        await expect(resolveDoctorSubmitClientId({directory, configName})).resolves.toBe('named-client-id')
        expect(getCachedAppInfo).not.toHaveBeenCalled()
      })
    },
  )

  test('reads the cached config instead of the default config', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeFile(joinPath(directory, 'shopify.app.toml'), 'client_id = "default-client-id"')
      await writeFile(joinPath(directory, 'shopify.app.production.toml'), 'client_id = "cached-client-id"')
      vi.mocked(getCachedAppInfo).mockReturnValue({directory, configFile: 'shopify.app.production.toml'})

      await expect(resolveDoctorSubmitClientId({directory})).resolves.toBe('cached-client-id')
    })
  })

  test('an explicit config overrides a stale cached config', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeFile(joinPath(directory, 'shopify.app.production.toml'), 'client_id = "named-client-id"')
      vi.mocked(getCachedAppInfo).mockReturnValue({directory, configFile: 'shopify.app.deleted.toml'})

      await expect(resolveDoctorSubmitClientId({directory, configName: 'production'})).resolves.toBe('named-client-id')
      expect(getCachedAppInfo).not.toHaveBeenCalled()
    })
  })

  test('rejects a stale cached config without falling back to another app', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeFile(joinPath(directory, 'shopify.app.toml'), 'client_id = "default-client-id"')
      await writeFile(joinPath(directory, 'shopify.app.other.toml'), 'client_id = "other-client-id"')
      vi.mocked(getCachedAppInfo).mockReturnValue({directory, configFile: 'shopify.app.deleted.toml'})

      const error = await resolveDoctorSubmitClientId({directory}).catch((error: unknown) => error)

      expect(error).toBeInstanceOf(AbortError)
      expect(error).toMatchObject({
        message: expect.stringContaining('shopify.app.deleted.toml'),
        nextSteps: [expect.stringMatching(/--config.*--client-id/)],
      })
    })
  })

  test.each([undefined, 'missing'])(
    'rejects a missing selected config (%s) with actionable guidance',
    async (configName) => {
      await inTemporaryDirectory(async (directory) => {
        await writeFile(joinPath(directory, 'shopify.app.other.toml'), 'client_id = "other-client-id"')

        const error = await resolveDoctorSubmitClientId({directory, configName}).catch((error: unknown) => error)

        expect(error).toBeInstanceOf(AbortError)
        expect(error).toMatchObject({
          message: expect.stringContaining(configName ? 'shopify.app.missing.toml' : 'shopify.app.toml'),
          nextSteps: [expect.stringMatching(/--config.*--client-id/)],
        })
      })
    },
  )

  test('rejects malformed TOML even when it contains a client ID', async () => {
    await inTemporaryDirectory(async (directory) => {
      const configPath = joinPath(directory, 'shopify.app.toml')
      await writeFile(configPath, 'client_id = "default-client-id"\ninvalid = [')
      const parserError = await TomlFile.read(configPath).catch((error: unknown) => error)
      const error = await resolveDoctorSubmitClientId({directory}).catch((error: unknown) => error)

      expect(parserError).toBeInstanceOf(AbortError)
      expect(error).toBeInstanceOf(AbortError)
      expect(error).toMatchObject({
        message: `Couldn't read app configuration at ${configPath}: ${(parserError as AbortError).message}`,
        nextSteps: [expect.stringMatching(/--config.*--client-id/)],
      })
    })
  })

  test.each([
    'name = "unlinked-app"',
    'client_id = 123',
    'client_id = true',
    'client_id = ["invalid-client-id"]',
    'client_id = {value = "invalid-client-id"}',
    'client_id = ""',
    'client_id = " \\t "',
  ])('rejects a missing, invalid, or blank client ID (%s) with linking guidance', async (content) => {
    await inTemporaryDirectory(async (directory) => {
      await writeFile(joinPath(directory, 'shopify.app.toml'), content)

      const error = await resolveDoctorSubmitClientId({directory}).catch((error: unknown) => error)

      expect(error).toBeInstanceOf(AbortError)
      expect(error).toMatchObject({
        message: expect.stringMatching(/shopify\.app\.toml.*non-empty string client_id/),
        nextSteps: [expect.stringMatching(/--client-id.*shopify app config link/)],
      })
    })
  })

  test.each([
    {content: '# Preserve this comment\nclient_id = "linked-client-id"\n', clientId: 'linked-client-id'},
    {content: 'client_id = [', clientId: undefined},
    {content: 'name = "unlinked-app"', clientId: undefined},
  ])('does not write configs or hidden app state when reading $content', async ({content, clientId}) => {
    await inTemporaryDirectory(async (directory) => {
      await writeFile(joinPath(directory, 'shopify.app.toml'), content)
      await writeFile(joinPath(directory, 'shopify.app.other.toml'), '# Leave this config alone\nclient_id = "other"')
      const initialFiles = (await readdir(directory)).sort()
      const initialContents = await Promise.all(initialFiles.map((file) => readFile(joinPath(directory, file))))
      await expect(fileExists(joinPath(directory, '.shopify'))).resolves.toBe(false)

      const result = resolveDoctorSubmitClientId({directory})
      if (clientId) {
        await expect(result).resolves.toBe(clientId)
      } else {
        await expect(result).rejects.toBeInstanceOf(AbortError)
      }

      expect((await readdir(directory)).sort()).toEqual(initialFiles)
      await expect(Promise.all(initialFiles.map((file) => readFile(joinPath(directory, file))))).resolves.toEqual(
        initialContents,
      )
      await expect(fileExists(joinPath(directory, '.shopify'))).resolves.toBe(false)
    })
  })
})
