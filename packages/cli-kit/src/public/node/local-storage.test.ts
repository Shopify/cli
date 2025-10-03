/* eslint-disable @typescript-eslint/dot-notation */
import {LocalStorage} from './local-storage.js'
import {inTemporaryDirectory} from './fs.js'
import {AbortError} from './error.js'
import * as fs from './fs.js'
import {describe, expect, test, vi} from 'vitest'

interface TestSchema {
  testValue: string
}

describe('storage', () => {
  test('set and returns a value', async () => {
    await inTemporaryDirectory((cwd) => {
      // Given
      const storage = new LocalStorage<TestSchema>({cwd})

      // When
      storage.set('testValue', 'test')
      const got = storage.get('testValue')

      // Then
      expect(got).toEqual('test')
    })
  })

  test('deletes the value if present', async () => {
    await inTemporaryDirectory((cwd) => {
      // Given
      const storage = new LocalStorage<TestSchema>({cwd})

      // When
      storage.set('testValue', 'test')
      const got = storage.get('testValue')
      storage.delete('testValue')
      const got2 = storage.get('testValue')

      // Then
      expect(got).toEqual('test')
      expect(got2).toEqual(undefined)
    })
  })

  test('clears all values', async () => {
    await inTemporaryDirectory((cwd) => {
      // Given
      const storage = new LocalStorage<TestSchema>({cwd})

      // When
      storage.set('testValue', 'test')
      const got = storage.get('testValue')
      storage.clear()
      const got2 = storage.get('testValue')

      // Then
      expect(got).toEqual('test')
      expect(got2).toEqual(undefined)
    })
  })
})

describe('error handling', () => {
  test('throws AbortError when file lacks write permissions', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const storage = new LocalStorage<TestSchema>({cwd})
      storage.set('testValue', 'test')

      // Mock to simulate no write permissions
      vi.spyOn(fs, 'fileHasWritePermissions').mockReturnValue(false)
      vi.spyOn(fs, 'unixFileIsOwnedByCurrentUser').mockReturnValue(true)

      // Mock Config to throw
      storage['config'].set = vi.fn(() => {
        throw new Error('EACCES: permission denied')
      })
      storage['config'].get = vi.fn(() => {
        throw new Error('EACCES: permission denied')
      })
      storage['config'].delete = vi.fn(() => {
        throw new Error('EACCES: permission denied')
      })
      storage['config'].clear = vi.fn(() => {
        throw new Error('EACCES: permission denied')
      })

      // When/Then
      expect(() => storage.set('testValue', 'updated')).toThrow(AbortError)
      expect(() => storage.set('testValue', 'updated')).toThrow(/Failed to access local storage/)

      expect(() => storage.get('testValue')).toThrow(AbortError)
      expect(() => storage.get('testValue')).toThrow(/Failed to access local storage/)

      expect(() => storage.delete('testValue')).toThrow(AbortError)
      expect(() => storage.delete('testValue')).toThrow(/Failed to access local storage/)

      expect(() => storage.clear()).toThrow(AbortError)
      expect(() => storage.clear()).toThrow(/Failed to access local storage/)
    })
  })

  test('throws AbortError when file is owned by different user', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const storage = new LocalStorage<TestSchema>({cwd})
      storage.set('testValue', 'test')

      // Mock to simulate ownership issue
      vi.spyOn(fs, 'fileHasWritePermissions').mockReturnValue(true)
      vi.spyOn(fs, 'unixFileIsOwnedByCurrentUser').mockReturnValue(false)

      // Mock Config to throw

      storage['config'].get = vi.fn(() => {
        throw new Error('EACCES: permission denied')
      })

      // When/Then
      try {
        storage.get('testValue')
        expect.fail('Should have thrown')
      } catch (error) {
        if (error instanceof AbortError) {
          const tryMessageStr = JSON.stringify(error.tryMessage)
          expect(tryMessageStr).toContain('owned by a different user')
          expect(tryMessageStr).toContain('elevated permissions')
          expect(tryMessageStr).toContain('remove the Shopify CLI preferences folder')
        } else {
          throw error
        }
      }
    })
  })

  test('throws BugError when error is not permission-related', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const storage = new LocalStorage<TestSchema>({cwd})

      // Mock to simulate good permissions
      vi.spyOn(fs, 'fileHasWritePermissions').mockReturnValue(true)
      vi.spyOn(fs, 'unixFileIsOwnedByCurrentUser').mockReturnValue(true)

      // Mock Config to throw non-permission error

      storage['config'].set = vi.fn(() => {
        throw new Error('Invalid JSON format')
      })

      // When/Then
      expect(() => storage.set('testValue', 'test')).toThrow(/Unexpected error while accessing local storage/)
    })
  })
})
