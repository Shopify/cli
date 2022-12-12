import {getLocalization, Localization} from './localization.js'
import {testUIExtension} from '../../../models/app/app.test-data.js'
import {ExtensionDevOptions} from '../extension.js'
import {file, path, output} from '@shopify/cli-kit'
import {describe, expect, it, vi} from 'vitest'

async function testGetLocalization(tmpDir: string, currentLocalization?: Localization) {
  const mockOptions = {} as unknown as ExtensionDevOptions

  const extension = await testUIExtension({
    configuration: {
      name: 'mock-name',
      type: 'checkout_ui_extension',
      metafields: [],
      capabilities: {
        block_progress: false,
        network_access: false,
      },
    },
    idEnvironmentVariableName: 'mockId',
    localIdentifier: 'localIdentifier',
    configurationPath: `${tmpDir}/shopify.ui.extension.toml`,
    directory: tmpDir,
    type: 'checkout_ui_extension',
    graphQLType: 'graphQLType',
    devUUID: 'dev-uuid',
    outputBundlePath: `${tmpDir}/dist/main.js`,
    entrySourceFilePath: `${tmpDir}/dist/main.js`,
  })
  return getLocalization(extension, {...mockOptions, currentLocalizationPayload: currentLocalization})
}

describe('when there are no locale files', () => {
  it('returns undefined as the localization', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      const result = await testGetLocalization(tmpDir)
      expect(result.status).toBe('')
    })
  })

  it("returns 'success' as the status", async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      const result = await testGetLocalization(tmpDir)
      expect(result.localization).toBe(undefined)
    })
  })
})

describe('when there are locale files', () => {
  it('returns defaultLocale using the locale marked as .default', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      await file.mkdir(path.join(tmpDir, 'locales'))
      await file.write(path.join(tmpDir, 'locales', 'en.json'), '{"lorem": "ipsum}')
      await file.write(path.join(tmpDir, 'locales', 'de.default.json'), '{"lorem": "ipsum}')

      const result = await testGetLocalization(tmpDir)

      expect(result.localization!.defaultLocale).toBe('de')
    })
  })

  it("returns 'en' for defaultLocale when no locale is marked as .default", async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      await file.mkdir(path.join(tmpDir, 'locales'))
      await file.write(path.join(tmpDir, 'locales', 'en.json'), '{"lorem": "ipsum}')
      await file.write(path.join(tmpDir, 'locales', 'de.json'), '{"lorem": "ipsum}')

      const result = await testGetLocalization(tmpDir)

      expect(result.localization!.defaultLocale).toBe('en')
    })
  })

  it('returns the contents of every locale file as translations', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      await file.mkdir(path.join(tmpDir, 'locales'))
      await file.write(path.join(tmpDir, 'locales', 'en.json'), '{"greeting": "Hi!"}')
      await file.write(path.join(tmpDir, 'locales', 'fr.json'), '{"greeting": "Bonjour!"}')

      const result = await testGetLocalization(tmpDir)

      expect(result.localization!.translations).toStrictEqual({
        en: {greeting: 'Hi!'},
        fr: {greeting: 'Bonjour!'},
      })
    })
  })

  it('returns the lastUpdated timestamp of the most recently updated locale', async () => {
    let timestamp = 0
    vi.spyOn(Date, 'now').mockImplementation(() => {
      return (timestamp += 1)
    })

    await file.inTemporaryDirectory(async (tmpDir) => {
      await file.mkdir(path.join(tmpDir, 'locales'))
      await file.write(path.join(tmpDir, 'locales', 'en.json'), '{"greeting": "Hi!"}')
      await file.write(path.join(tmpDir, 'locales', 'fr.json'), '{"greeting": "Bonjour!"}')
      await file.write(path.join(tmpDir, 'locales', 'es.json'), '{"greeting": "Hola!"}')

      const result = await testGetLocalization(tmpDir)

      expect(Date.now).toBeCalledTimes(4)
      expect(result.localization!.lastUpdated).equals(timestamp)
    })
  })
  it('returns the last succesful locale built when there are JSON errors', async () => {
    let timestamp = 0
    vi.spyOn(Date, 'now').mockImplementation(() => {
      return (timestamp += 1)
    })

    await file.inTemporaryDirectory(async (tmpDir) => {
      await file.mkdir(path.join(tmpDir, 'locales'))
      await file.write(path.join(tmpDir, 'locales', 'en.json'), '{"greeting": "Hi!"}')
      const {localization: lastSuccesfulLocalization} = await testGetLocalization(tmpDir)

      await file.write(path.join(tmpDir, 'locales', 'es.json'), '{"greeting: "Hola!"}')

      const result = await testGetLocalization(tmpDir, lastSuccesfulLocalization)

      expect(result.localization!.lastUpdated).equals(lastSuccesfulLocalization!.lastUpdated)
    })
  })
  it("returns 'success' as the status when there are no JSON errors", async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      await file.mkdir(path.join(tmpDir, 'locales'))
      await file.write(path.join(tmpDir, 'locales', 'en.json'), '{"greeting": "Hi!"}')
      await file.write(path.join(tmpDir, 'locales', 'fr.json'), '{"greeting": "Bonjour!"}')

      const result = await testGetLocalization(tmpDir)

      expect(result.status).toBe('success')
    })
  })
  it('outputs message when there are no JSON errors', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      vi.spyOn(output, 'info')

      await file.mkdir(path.join(tmpDir, 'locales'))
      await file.write(path.join(tmpDir, 'locales', 'en.json'), '{"greeting": "Hi!"}')
      await file.write(path.join(tmpDir, 'locales', 'fr.json'), '{"greeting": "Bonjour!"}')

      const result = await testGetLocalization(tmpDir)

      expect(output.info).toHaveBeenCalledWith(expect.stringContaining('mock-name'), undefined)
      expect(output.info).toHaveBeenCalledWith(expect.stringContaining(tmpDir), undefined)
    })
  })

  it("retuns 'error' as the status when there are no JSON errors", async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      const invalidJson = '{invalid_json: "Hi!"'
      await file.mkdir(path.join(tmpDir, 'locales'))
      await file.write(path.join(tmpDir, 'locales', 'en.json'), invalidJson)

      const result = await testGetLocalization(tmpDir)

      expect(result.status).toBe('error')
    })
  })
})
