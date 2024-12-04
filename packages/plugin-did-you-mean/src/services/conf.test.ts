import {ConfigSchema, isAutocorrectEnabled, setAutocorrect} from './conf.js'
import {describe, expect, test} from 'vitest'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {LocalStorage} from '@shopify/cli-kit/node/local-storage'

describe('did-you-mean config', async () => {
  test('isAutocorrectEnabled returns false if no cached value exists', async () => {
    await inTemporaryDirectory(async (cwd) => {
      const conf = new LocalStorage<ConfigSchema>({cwd})
      expect(isAutocorrectEnabled(conf)).toBe(false)
    })
  })

  test('isAutocorrectEnabled returns true if cached value is true', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const conf = new LocalStorage<ConfigSchema>({cwd})
      conf.set('autocorrectEnabled', true)

      // When
      const got = isAutocorrectEnabled(conf)

      // Then
      expect(got).toBeTruthy()
    })
  })

  test('isAutocorrectEnabled returns false if cached value is false', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const conf = new LocalStorage<ConfigSchema>({cwd})
      conf.set('autocorrectEnabled', false)

      // When
      const got = isAutocorrectEnabled(conf)

      // Then
      expect(got).toBeFalsy()
    })
  })

  test('setAutocorrect caches value for true', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const conf = new LocalStorage<ConfigSchema>({cwd})
      conf.set('autocorrectEnabled', false)

      // When
      setAutocorrect(true, conf)
      const got = isAutocorrectEnabled(conf)

      // Then
      expect(got).toBeTruthy()
    })
  })

  test('setAutocorrect caches value for false', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const conf = new LocalStorage<ConfigSchema>({cwd})
      conf.set('autocorrectEnabled', true)

      // When
      setAutocorrect(false, conf)
      const got = isAutocorrectEnabled(conf)

      // Then
      expect(got).toBeFalsy()
    })
  })
})
