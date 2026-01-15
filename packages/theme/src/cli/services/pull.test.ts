import {isEmptyDir, pull, PullFlags} from './pull.js'
import {setThemeStore, getActiveThemeDevSession} from './local-storage.js'
import {findOrSelectTheme} from '../utilities/theme-selector.js'
import {ensureThemeStore} from '../utilities/theme-store.js'
import {DevelopmentThemeManager} from '../utilities/development-theme-manager.js'
import {hasRequiredThemeDirectories, mountThemeFileSystem} from '../utilities/theme-fs.js'
import {fakeThemeFileSystem} from '../utilities/theme-fs/theme-fs-mock-factory.js'
import {downloadTheme} from '../utilities/theme-downloader.js'
import {themeComponent, ensureDirectoryConfirmed} from '../utilities/theme-ui.js'
import {mkTmpDir, rmdir} from '@shopify/cli-kit/node/fs'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {fetchChecksums} from '@shopify/cli-kit/node/themes/api'
import {insideGitDirectory, isClean} from '@shopify/cli-kit/node/git'
import {renderWarning} from '@shopify/cli-kit/node/ui'
import {test, describe, expect, vi, beforeEach} from 'vitest'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {fileURLToPath} from 'node:url'

vi.mock('./local-storage.js', async (importOriginal) => {
  const actual: object = await importOriginal()
  return {
    ...actual,
    getActiveThemeDevSession: vi.fn(),
  }
})
vi.mock('../utilities/theme-selector.js')
vi.mock('../utilities/theme-store.js')
vi.mock('../utilities/theme-fs.js')
vi.mock('../utilities/theme-downloader.js')
vi.mock('../utilities/theme-ui.js')
vi.mock('@shopify/cli-kit/node/context/local')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/themes/api')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/git')

const adminSession = {token: '', storeFqdn: ''}
const path = '/my-theme'
const defaultFlags: PullFlags = {
  path,
  development: false,
  live: false,
  nodelete: false,
  only: [],
  ignore: [],
  force: false,
}
const localThemeFileSystem = fakeThemeFileSystem(path, new Map())

describe('pull', () => {
  const findDevelopmentThemeSpy = vi.spyOn(DevelopmentThemeManager.prototype, 'find')
  const fetchDevelopmentThemeSpy = vi.spyOn(DevelopmentThemeManager.prototype, 'fetch')

  beforeEach(() => {
    vi.mocked(ensureThemeStore).mockImplementation(() => {
      const themeStore = 'example.myshopify.com'
      setThemeStore(themeStore)
      return themeStore
    })
    vi.mocked(ensureAuthenticatedThemes).mockResolvedValue(adminSession)
    vi.mocked(mountThemeFileSystem).mockReturnValue(localThemeFileSystem)
    vi.mocked(fetchChecksums).mockResolvedValue([])
    vi.mocked(themeComponent).mockReturnValue([])
    findDevelopmentThemeSpy.mockClear()
    fetchDevelopmentThemeSpy.mockClear()
  })

  test('should pass theme to downloadTheme', async () => {
    // Given
    const theme = buildTheme({id: 1, name: 'Theme', role: 'development'})!
    vi.mocked(findOrSelectTheme).mockResolvedValue(theme)
    vi.mocked(fetchDevelopmentThemeSpy).mockResolvedValue(undefined)

    // When
    await pull({...defaultFlags, theme: theme.id.toString()})

    // Then
    expect(findDevelopmentThemeSpy).not.toHaveBeenCalled()
    expect(fetchDevelopmentThemeSpy).toHaveBeenCalledOnce()
    expect(downloadTheme).toHaveBeenCalledWith(
      theme,
      adminSession,
      [],
      localThemeFileSystem,
      expect.any(Object),
      undefined,
    )
  })

  test('should pass the development theme to downloadtheme if development flag is provided', async () => {
    // Given
    const developmentTheme = buildTheme({id: 1, name: 'Theme', role: 'development'})!
    vi.mocked(findDevelopmentThemeSpy).mockResolvedValue(developmentTheme)
    vi.mocked(findOrSelectTheme).mockResolvedValue(developmentTheme)

    // When
    await pull({...defaultFlags, development: true, theme: '3'})

    // Then
    expect(findOrSelectTheme).toHaveBeenCalledWith(
      adminSession,
      expect.objectContaining({filter: {theme: developmentTheme.id.toString(), live: false}}),
    )
  })

  test('should ask for confirmation if the current directory is a Git directory and is not clean', async () => {
    // Given
    const theme = buildTheme({id: 1, name: 'Theme', role: 'development'})!
    vi.mocked(insideGitDirectory).mockResolvedValue(true)
    vi.mocked(isClean).mockResolvedValue(false)
    vi.mocked(ensureDirectoryConfirmed).mockResolvedValue(false)

    // When
    await pull({...defaultFlags, theme: theme.id.toString()})

    // Then
    expect(vi.mocked(ensureDirectoryConfirmed)).toHaveBeenCalledWith(
      false,
      'The current Git directory has uncommitted changes.',
      undefined,
      undefined,
    )
  })

  test('should not ask for confirmation if --force flag is provided', async () => {
    // Given
    const theme = buildTheme({id: 1, name: 'Theme', role: 'development'})!
    vi.mocked(findOrSelectTheme).mockResolvedValue(theme)
    vi.mocked(fetchDevelopmentThemeSpy).mockResolvedValue(undefined)

    // When
    await pull({...defaultFlags, theme: theme.id.toString(), force: true})

    // Then
    expect(vi.mocked(findOrSelectTheme)).toHaveBeenCalledOnce()
    expect(vi.mocked(hasRequiredThemeDirectories)).not.toHaveBeenCalled()
    expect(vi.mocked(insideGitDirectory)).not.toHaveBeenCalled()
    expect(vi.mocked(isClean)).not.toHaveBeenCalled()
    expect(vi.mocked(ensureDirectoryConfirmed)).not.toHaveBeenCalled()
  })

  test('should warn when a dev session is active in the directory', async () => {
    // Given
    const theme = buildTheme({id: 1, name: 'Theme', role: 'development'})!
    vi.mocked(findOrSelectTheme).mockResolvedValue(theme)
    vi.mocked(fetchDevelopmentThemeSpy).mockResolvedValue(undefined)
    vi.mocked(getActiveThemeDevSession).mockReturnValue({
      pid: 12345,
      port: 9292,
      store: 'example.myshopify.com',
      startedAt: Date.now(),
      themeId: '1',
    })

    // When
    await pull({...defaultFlags, theme: theme.id.toString()})

    // Then
    expect(renderWarning).toHaveBeenCalledWith({
      headline: 'A theme dev session is active in this directory.',
      body: [
        'A dev session is active on port: 9292).',
        'Running pull while dev is active may cause files to be unexpectedly deleted from your development theme. Consider stopping the dev server first.',
      ],
    })
  })

  describe('isEmptyDir', () => {
    test('returns true when directory is empty', async () => {
      // Given
      const locationOfThisFile = dirname(fileURLToPath(import.meta.url))
      const root = joinPath(locationOfThisFile, '../utilities/fixtures/theme')

      // When
      const result = await isEmptyDir(root)

      // Then
      expect(result).toBeFalsy()
    })

    test(`returns false when directory is not empty`, async () => {
      // Given
      const root = await mkTmpDir()

      // When
      const result = await isEmptyDir(root)

      // Then
      expect(result).toBeTruthy()
      await rmdir(root, {force: true})
    })
  })
})
