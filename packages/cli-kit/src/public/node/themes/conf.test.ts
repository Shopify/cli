import {getHostTheme, setHostTheme, removeHostTheme, hostThemeLocalStorage} from './conf.js'
import {describe, test, expect, vi, beforeEach} from 'vitest'

vi.mock('../local-storage.js', () => {
  return {
    LocalStorage: class {
      get = vi.fn()
      set = vi.fn()
      delete = vi.fn()
    },
  }
})

describe('conf', () => {
  beforeEach(() => {
    const storage = hostThemeLocalStorage()
    vi.mocked(storage.get).mockReset()
    vi.mocked(storage.set).mockReset()
    vi.mocked(storage.delete).mockReset()
  })

  test('getHostTheme gets theme from local storage', () => {
    const storage = hostThemeLocalStorage()
    vi.mocked(storage.get).mockReturnValue('12345')

    const got = getHostTheme('example.myshopify.com')

    expect(got).toBe('12345')
    expect(storage.get).toHaveBeenCalledWith('example.myshopify.com')
  })

  test('setHostTheme sets theme in local storage', () => {
    const storage = hostThemeLocalStorage()

    setHostTheme('example.myshopify.com', '12345')

    expect(storage.set).toHaveBeenCalledWith('example.myshopify.com', '12345')
  })

  test('removeHostTheme deletes theme from local storage', () => {
    const storage = hostThemeLocalStorage()

    removeHostTheme('example.myshopify.com')

    expect(storage.delete).toHaveBeenCalledWith('example.myshopify.com')
  })

  test('hostThemeLocalStorage returns LocalStorage instance', () => {
    const storage = hostThemeLocalStorage()
    expect(storage).toBeDefined()
  })
})
