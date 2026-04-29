import {loadLocalesConfig} from './locales-configuration.js'
import {describe, expect, test} from 'vitest'
import {inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import fs from 'fs'

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

  test('Throws with a helpful message if a locale file contains invalid UTF-8 bytes', async () => {
    await inTemporaryDirectory(async (tmpDir: string) => {
      // Given
      const localesPath = joinPath(tmpDir, 'locales')
      const enDefault = joinPath(localesPath, 'en.default.json')
      const it = joinPath(localesPath, 'it.json')

      await mkdir(localesPath)
      await writeFile(enDefault, JSON.stringify({hello: 'Hello'}))
      // 0xE0 starts a 3-byte UTF-8 sequence but is followed by an ASCII space,
      // mirroring the Latin-1 encoded "sarà" (`sar\xE0`) reported in shop/issues-develop#21558.
      const invalidBytes = Buffer.concat([
        Buffer.from('{"hello":"sar', 'utf8'),
        Buffer.from([0xe0]),
        Buffer.from(' "}', 'utf8'),
      ])
      fs.writeFileSync(it, invalidBytes)

      // When
      const got = loadLocalesConfig(tmpDir, 'checkout_ui')
      await expect(got).rejects.toThrow(/Error loading checkout_ui/)
      await expect(got).rejects.toMatchObject({
        tryMessage: expect.stringMatching(/invalid UTF-8 byte sequences/),
      })
      await expect(got).rejects.toMatchObject({
        tryMessage: expect.stringMatching(/it\.json/),
      })
    })
  })
})
