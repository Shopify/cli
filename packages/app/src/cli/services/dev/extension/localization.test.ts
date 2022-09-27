import {getLocalization} from './localization.js'
import {file, path} from '@shopify/cli-kit'
import {describe, expect, it} from 'vitest'

async function testGetLocalization(tmpDir: string) {
  return getLocalization({
    configuration: {
      name: 'mock-name',
      type: 'checkout_ui_extension',
      metafields: [],
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
}

describe('when there are no locale files', () => {
  it('returns undefined as the localization', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      const result = await testGetLocalization(tmpDir)
      expect(result.status).toBe('success')
    })
  })

  it("returns 'success' as the status", async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      const result = await testGetLocalization(tmpDir)
      expect(result.localization).toBe(undefined)
    })
  })
})

describe('when there locale files', () => {
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
    await file.inTemporaryDirectory(async (tmpDir) => {
      await file.mkdir(path.join(tmpDir, 'locales'))
      await file.write(path.join(tmpDir, 'locales', 'en.json'), '{"greeting": "Hi!"}')
      await file.write(path.join(tmpDir, 'locales', 'fr.json'), '{"greeting": "Bonjour!"}')
      await file.write(path.join(tmpDir, 'locales', 'es.json'), '{"greeting": "Hola!"}')

      const result = await testGetLocalization(tmpDir)

      expect(result.localization!.lastUpdated).toBeLessThanOrEqual(Date.now())
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
