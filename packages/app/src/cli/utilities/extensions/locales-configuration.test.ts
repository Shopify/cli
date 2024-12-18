import {loadLocalesConfig} from './locales-configuration.js'
import {describe, expect, test} from 'vitest'
import {inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

describe('loadLocalesConfig', () => {
  test('Works if all locales are correct', async () => {
    await inTemporaryDirectory(async (tmpDir: string) => {
      // Given
      const localesPath = joinPath(tmpDir, 'locales')
      const enDefault = joinPath(localesPath, 'en.default.json')
      const es = joinPath(localesPath, 'es.json')

      await mkdir(localesPath)
      await writeFile(enDefault, JSON.stringify({hello: 'Hello'}))
      await writeFile(es, JSON.stringify({hello: 'Hola'}))

      // When
      const got = await loadLocalesConfig(tmpDir, 'checkout_ui')
      expect(got).toEqual({
        default_locale: 'en',
        translations: {en: 'eyJoZWxsbyI6IkhlbGxvIn0=', es: 'eyJoZWxsbyI6IkhvbGEifQ=='},
      })
    })
  })

  test('Throws if one locale is empty', async () => {
    await inTemporaryDirectory(async (tmpDir: string) => {
      // Given
      const localesPath = joinPath(tmpDir, 'locales')
      const enDefault = joinPath(localesPath, 'en.default.json')
      const es = joinPath(localesPath, 'es.json')

      await mkdir(localesPath)
      await writeFile(enDefault, JSON.stringify({hello: 'Hello'}))
      await writeFile(es, '')

      // When
      const got = loadLocalesConfig(tmpDir, 'checkout_ui')
      await expect(got).rejects.toThrow(/Error loading checkout_ui/)
    })
  })

  test('Throws if one locale is too big', async () => {
    await inTemporaryDirectory(async (tmpDir: string) => {
      // Given
      const localesPath = joinPath(tmpDir, 'locales')
      const enDefault = joinPath(localesPath, 'en.default.json')
      const es = joinPath(localesPath, 'es.json')

      await mkdir(localesPath)
      await writeFile(enDefault, JSON.stringify({hello: 'Hello'}))
      const bigArray = new Array(6000).fill('a')
      await writeFile(es, JSON.stringify(bigArray))

      // When
      const got = loadLocalesConfig(tmpDir, 'checkout_ui')
      await expect(got).rejects.toThrow(/Error loading checkout_ui/)
    })
  })

  test('Throws if there are no defaults', async () => {
    await inTemporaryDirectory(async (tmpDir: string) => {
      // Given
      const localesPath = joinPath(tmpDir, 'locales')
      const en = joinPath(localesPath, 'en.json')
      const es = joinPath(localesPath, 'es.json')

      await mkdir(localesPath)
      await writeFile(en, JSON.stringify({hello: 'Hello'}))
      await writeFile(es, JSON.stringify({hello: 'Hola'}))

      // When
      const got = loadLocalesConfig(tmpDir, 'checkout_ui')
      await expect(got).rejects.toThrow(/Missing default language in checkout_ui configuration/)
    })
  })

  test('Throws if there are multiple defaults', async () => {
    await inTemporaryDirectory(async (tmpDir: string) => {
      // Given
      const localesPath = joinPath(tmpDir, 'locales')
      const en = joinPath(localesPath, 'en.default.json')
      const es = joinPath(localesPath, 'es.default.json')

      await mkdir(localesPath)
      await writeFile(en, JSON.stringify({hello: 'Hello'}))
      await writeFile(es, JSON.stringify({hello: 'Hola'}))

      // When
      const got = loadLocalesConfig(tmpDir, 'checkout_ui')
      await expect(got).rejects.toThrow(/Error loading checkout_ui/)
    })
  })

  test('Throws if bundle is too big', async () => {
    await inTemporaryDirectory(async (tmpDir: string) => {
      // Given
      const localesPath = joinPath(tmpDir, 'locales')
      const en = joinPath(localesPath, 'en.default.json')
      const es = joinPath(localesPath, 'es.json')

      await mkdir(localesPath)
      const bigArray = JSON.stringify(new Array(4000).fill('a'))

      await writeFile(en, JSON.stringify(bigArray))
      await writeFile(es, JSON.stringify(bigArray))

      // When
      const got = loadLocalesConfig(tmpDir, 'checkout_ui')
      await expect(got).rejects.toThrow(/Error loading checkout_ui/)
    })
  })
})
