/* eslint-disable @typescript-eslint/naming-convention */
import {loadLocalesConfig} from './locales-configuration'
import {describe, expect, it} from 'vitest'
import {temporary} from '@shopify/cli-testing'
import {file, path} from '@shopify/cli-kit'

describe('loadLocalesConfig', () => {
  it('Works if all locales are correct', async () => {
    await temporary.directory(async (tmpDir: string) => {
      // Given
      const localesPath = path.join(tmpDir, 'locales')
      const enDefault = path.join(localesPath, 'en.default.json')
      const es = path.join(localesPath, 'es.json')

      await file.mkdir(localesPath)
      await file.write(enDefault, JSON.stringify({hello: 'Hello'}))
      await file.write(es, JSON.stringify({hello: 'Hola'}))

      // When
      const got = await loadLocalesConfig(tmpDir)
      expect(got).toEqual({
        default_locale: 'en',
        translations: {en: 'eyJoZWxsbyI6IkhlbGxvIn0=', es: 'eyJoZWxsbyI6IkhvbGEifQ=='},
      })
    })
  })

  it('Throws if one locale is empty', async () => {
    await temporary.directory(async (tmpDir: string) => {
      // Given
      const localesPath = path.join(tmpDir, 'locales')
      const enDefault = path.join(localesPath, 'en.default.json')
      const es = path.join(localesPath, 'es.json')

      await file.mkdir(localesPath)
      await file.write(enDefault, JSON.stringify({hello: 'Hello'}))
      await file.write(es, '')

      // When
      const got = loadLocalesConfig(tmpDir)
      await expect(got).rejects.toThrow(/Error loading checkout_ui/)
    })
  })

  it('Throws if one locale is too big', async () => {
    await temporary.directory(async (tmpDir: string) => {
      // Given
      const localesPath = path.join(tmpDir, 'locales')
      const enDefault = path.join(localesPath, 'en.default.json')
      const es = path.join(localesPath, 'es.json')

      await file.mkdir(localesPath)
      await file.write(enDefault, JSON.stringify({hello: 'Hello'}))
      const bigArray = new Array(5000).fill('a')
      await file.write(es, JSON.stringify(bigArray))

      // When
      const got = loadLocalesConfig(tmpDir)
      await expect(got).rejects.toThrow(/Error loading checkout_ui/)
    })
  })

  it('Throws if there are no defaults', async () => {
    await temporary.directory(async (tmpDir: string) => {
      // Given
      const localesPath = path.join(tmpDir, 'locales')
      const en = path.join(localesPath, 'en.json')
      const es = path.join(localesPath, 'es.json')

      await file.mkdir(localesPath)
      await file.write(en, JSON.stringify({hello: 'Hello'}))
      await file.write(es, JSON.stringify({hello: 'Hola'}))

      // When
      const got = loadLocalesConfig(tmpDir)
      await expect(got).rejects.toThrow(/Missing default language in checkout_ui configuration/)
    })
  })

  it('Throws if there are multiple defaults', async () => {
    await temporary.directory(async (tmpDir: string) => {
      // Given
      const localesPath = path.join(tmpDir, 'locales')
      const en = path.join(localesPath, 'en.default.json')
      const es = path.join(localesPath, 'es.default.json')

      await file.mkdir(localesPath)
      await file.write(en, JSON.stringify({hello: 'Hello'}))
      await file.write(es, JSON.stringify({hello: 'Hola'}))

      // When
      const got = loadLocalesConfig(tmpDir)
      await expect(got).rejects.toThrow(/Error loading checkout_ui/)
    })
  })

  it('Throws if bundle is too big', async () => {
    await temporary.directory(async (tmpDir: string) => {
      // Given
      const localesPath = path.join(tmpDir, 'locales')
      const en = path.join(localesPath, 'en.default.json')
      const es = path.join(localesPath, 'es.json')

      await file.mkdir(localesPath)
      const bigArray = JSON.stringify(new Array(3000).fill('a'))

      await file.write(en, JSON.stringify(bigArray))
      await file.write(es, JSON.stringify(bigArray))

      // When
      const got = loadLocalesConfig(tmpDir)
      await expect(got).rejects.toThrow(/Error loading checkout_ui/)
    })
  })
})
