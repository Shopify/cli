import {ThemeManager} from './theme-manager.js'
import {Theme} from './types.js'
import {fetchTheme, findDevelopmentThemeByName, themeCreate} from './api.js'
import {DEVELOPMENT_THEME_ROLE, UNPUBLISHED_THEME_ROLE} from './utils.js'
import {BugError} from '../error.js'
import {test, describe, expect, vi, beforeEach} from 'vitest'

vi.mock('./api.js')
vi.mock('../../../private/node/themes/generate-theme-name.js', () => ({
  generateThemeName: vi.fn((context: string) => `${context} (test-123-hostname)`),
}))

const session = {token: 'token', storeFqdn: 'my-shop.myshopify.com', refresh: async () => {}}

class TestThemeManager extends ThemeManager {
  protected context = 'test-context'
  private storedThemeId: string | undefined

  constructor(adminSession: any) {
    super(adminSession)
    this.storedThemeId = undefined
  }

  getStoredThemeId(): string | undefined {
    return this.storedThemeId
  }

  setThemeId(themeId: string | undefined): void {
    this.themeId = themeId
  }

  protected setTheme(themeId: string): void {
    this.storedThemeId = themeId
    this.themeId = themeId
  }

  protected removeTheme(): void {
    this.storedThemeId = undefined
    this.themeId = undefined
  }
}

const mockTheme: Theme = {
  id: 123,
  name: 'Test Theme',
  role: DEVELOPMENT_THEME_ROLE,
  processing: false,
  createdAtRuntime: false,
}

describe('ThemeManager', () => {
  let manager: TestThemeManager

  beforeEach(() => {
    manager = new TestThemeManager(session)
  })

  describe('findOrCreate', () => {
    test('returns an existing theme when one exists', async () => {
      // Given
      manager.setThemeId('123')
      vi.mocked(fetchTheme).mockResolvedValue(mockTheme)

      // When
      const result = await manager.findOrCreate()

      // Then
      expect(fetchTheme).toHaveBeenCalledWith(123, session)
      expect(result).toEqual(mockTheme)
      expect(themeCreate).not.toHaveBeenCalled()
    })

    test('creates a new theme when one does not exist', async () => {
      // Given
      manager.setThemeId(undefined)
      vi.mocked(themeCreate).mockResolvedValue(mockTheme)

      expect(manager.getStoredThemeId()).toBeUndefined()

      // When
      const result = await manager.findOrCreate()

      // Then
      expect(fetchTheme).not.toHaveBeenCalled()
      expect(themeCreate).toHaveBeenCalledWith(
        {
          name: 'test-context (test-123-hostname)',
          role: DEVELOPMENT_THEME_ROLE,
        },
        session,
      )
      expect(result).toEqual(mockTheme)
      expect(manager.getStoredThemeId()).toBe('123')
    })

    test('searches through development themes of a given name', async () => {
      // Given
      vi.mocked(findDevelopmentThemeByName).mockResolvedValue(mockTheme)

      // When
      const result = await manager.findOrCreate('Dev', DEVELOPMENT_THEME_ROLE)

      // Then
      expect(fetchTheme).not.toHaveBeenCalled()
      expect(findDevelopmentThemeByName).toHaveBeenCalledWith('Dev', session)
      expect(result).toEqual(mockTheme)
      expect(themeCreate).not.toHaveBeenCalled()
    })
  })

  describe('fetch', () => {
    test('returns undefined when no themeId or name is set', async () => {
      // Given
      manager.setThemeId(undefined)

      // When
      const result = await manager.fetch()

      // Then
      expect(result).toBeUndefined()
      expect(fetchTheme).not.toHaveBeenCalled()
    })

    test('fetches and returns a theme when themeId is set', async () => {
      // Given
      manager.setThemeId('123')
      vi.mocked(fetchTheme).mockResolvedValue(mockTheme)

      // When
      const result = await manager.fetch()

      // Then
      expect(fetchTheme).toHaveBeenCalledWith(123, session)
      expect(result).toEqual(mockTheme)
    })

    test('fetches and returns a theme when name is set and role is development', async () => {
      // Given
      vi.mocked(findDevelopmentThemeByName).mockResolvedValue(mockTheme)

      // When
      const result = await manager.fetch('Dev', DEVELOPMENT_THEME_ROLE)

      // Then
      expect(fetchTheme).not.toHaveBeenCalled()
      expect(findDevelopmentThemeByName).toHaveBeenCalledWith('Dev', session)
      expect(result).toEqual(mockTheme)
    })

    test('removes theme when fetch returns undefined', async () => {
      // Given
      manager.setThemeId('123')
      vi.mocked(fetchTheme).mockResolvedValue(undefined)

      // When
      const result = await manager.fetch()

      // Then
      expect(fetchTheme).toHaveBeenCalledWith(123, session)
      expect(result).toBeUndefined()
      expect(manager.getStoredThemeId()).toBeUndefined()
    })
  })

  describe('generateThemeName', () => {
    test('generates a theme name with the provided context', () => {
      // When
      const result = manager.generateThemeName('my-app')

      // Then
      expect(result).toBe('my-app (test-123-hostname)')
    })
  })

  describe('create', () => {
    test('creates a new theme with default role and generated name', async () => {
      // Given
      vi.mocked(themeCreate).mockResolvedValue(mockTheme)

      // When
      const result = await manager.create()

      // Then
      expect(themeCreate).toHaveBeenCalledWith(
        {
          name: 'test-context (test-123-hostname)',
          role: DEVELOPMENT_THEME_ROLE,
        },
        session,
      )
      expect(result).toEqual(mockTheme)
      expect(manager.getStoredThemeId()).toBe('123')
    })

    test('creates a new theme with specified role and name', async () => {
      // Given
      const customTheme = {...mockTheme, name: 'Custom name', role: UNPUBLISHED_THEME_ROLE}
      vi.mocked(themeCreate).mockResolvedValue(customTheme)

      // When
      const result = await manager.create(UNPUBLISHED_THEME_ROLE, 'Custom name')

      // Then
      expect(themeCreate).toHaveBeenCalledWith(
        {
          name: 'Custom name',
          role: UNPUBLISHED_THEME_ROLE,
        },
        session,
      )
      expect(result).toEqual(customTheme)
      expect(manager.getStoredThemeId()).toBe('123')
    })

    test('throws BugError when theme creation fails', async () => {
      // Given
      vi.mocked(themeCreate).mockResolvedValue(undefined)

      // When/Then
      await expect(manager.create()).rejects.toThrow(BugError)
      await expect(manager.create()).rejects.toThrow(
        'Could not create theme with name "test-context (test-123-hostname)" and role "development"',
      )
    })
  })
})
