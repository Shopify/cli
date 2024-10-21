import {createOrSelectTheme, push, ThemeSelectionOptions} from './push.js'
import {PullFlags} from './pull.js'
import {setDevelopmentTheme} from './local-storage.js'
import {uploadTheme} from '../utilities/theme-uploader.js'
import {ensureThemeStore} from '../utilities/theme-store.js'
import {findOrSelectTheme} from '../utilities/theme-selector.js'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'
import {test, describe, vi, expect, beforeEach} from 'vitest'
import {createTheme, fetchTheme, publishTheme} from '@shopify/cli-kit/node/themes/api'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {
  DEVELOPMENT_THEME_ROLE,
  LIVE_THEME_ROLE,
  promptThemeName,
  UNPUBLISHED_THEME_ROLE,
} from '@shopify/cli-kit/node/themes/utils'
import {renderConfirmationPrompt} from '@shopify/cli-kit/node/ui'

vi.mock('../utilities/theme-uploader.js')
vi.mock('../utilities/theme-store.js')
vi.mock('../utilities/theme-selector.js')
vi.mock('./local-storage.js')
vi.mock('@shopify/cli-kit/node/themes/utils')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/themes/api')
vi.mock('@shopify/cli-kit/node/ui')

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
const adminSession = {token: '', storeFqdn: ''}

describe('push', () => {
  beforeEach(() => {
    vi.mocked(uploadTheme).mockResolvedValue({
      workPromise: Promise.resolve(),
      uploadResults: new Map(),
      renderThemeSyncProgress: () => Promise.resolve(),
    })
    vi.mocked(ensureThemeStore).mockReturnValue('example.myshopify.com')
    vi.mocked(ensureAuthenticatedThemes).mockResolvedValue(adminSession)
  })

  test('should call publishTheme if publish flag is provided', async () => {
    // Given
    const theme = buildTheme({id: 1, name: 'Theme', role: 'development'})!
    vi.mocked(findOrSelectTheme).mockResolvedValue(theme)

    // When
    await push({...defaultFlags, publish: true})

    // Then
    expect(publishTheme).toHaveBeenCalledWith(theme.id, adminSession)
  })
})

describe('createOrSelectTheme', async () => {
  test('creates unpublished theme when unpublished flag is provided', async () => {
    // Given
    vi.mocked(createTheme).mockResolvedValue(buildTheme({id: 2, name: 'Theme', role: UNPUBLISHED_THEME_ROLE}))
    vi.mocked(fetchTheme).mockResolvedValue(undefined)

    const flags: ThemeSelectionOptions = {unpublished: true}

    // When
    const theme = await createOrSelectTheme(adminSession, flags)

    // Then
    expect(theme).toMatchObject({role: UNPUBLISHED_THEME_ROLE})
    expect(setDevelopmentTheme).not.toHaveBeenCalled()
  })

  test('creates development theme when development flag is provided', async () => {
    // Given
    vi.mocked(createTheme).mockResolvedValue(buildTheme({id: 1, name: 'Theme', role: DEVELOPMENT_THEME_ROLE}))
    vi.mocked(fetchTheme).mockResolvedValue(undefined)
    const flags: ThemeSelectionOptions = {development: true}

    // When
    const theme = await createOrSelectTheme(adminSession, flags)

    // Then
    expect(theme).toMatchObject({role: DEVELOPMENT_THEME_ROLE})
    expect(setDevelopmentTheme).toHaveBeenCalled()
  })

  test('creates development theme when development and unpublished flags are provided', async () => {
    // Given
    vi.mocked(createTheme).mockResolvedValue(buildTheme({id: 1, name: 'Theme', role: DEVELOPMENT_THEME_ROLE}))
    vi.mocked(fetchTheme).mockResolvedValue(undefined)
    const flags: ThemeSelectionOptions = {development: true, unpublished: true}

    // When
    const theme = await createOrSelectTheme(adminSession, flags)

    // Then
    expect(theme).toMatchObject({role: DEVELOPMENT_THEME_ROLE})
  })

  test('returns live theme when live flag is provided', async () => {
    // Given
    vi.mocked(findOrSelectTheme).mockResolvedValue(buildTheme({id: 3, name: 'Live Theme', role: LIVE_THEME_ROLE})!)
    const flags: ThemeSelectionOptions = {live: true, 'allow-live': true}

    // When
    const theme = await createOrSelectTheme(adminSession, flags)

    // Then
    expect(theme).toMatchObject({role: LIVE_THEME_ROLE})
  })

  test("renders confirmation prompt if 'allow-live' flag is not provided and selected theme role is live", async () => {
    // Given
    vi.mocked(findOrSelectTheme).mockResolvedValue(buildTheme({id: 3, name: 'Live Theme', role: LIVE_THEME_ROLE})!)
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
    const flags: ThemeSelectionOptions = {live: true}

    // When
    const theme = await createOrSelectTheme(adminSession, flags)

    // Then
    expect(theme?.role).toBe(LIVE_THEME_ROLE)
    expect(renderConfirmationPrompt).toHaveBeenCalled()
  })

  test("renders confirmation prompt if 'allow-live' flag is not provided and live theme is specified via theme flag", async () => {
    // Given
    vi.mocked(findOrSelectTheme).mockResolvedValue(buildTheme({id: 3, name: 'Live Theme', role: LIVE_THEME_ROLE})!)
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
    const flags: ThemeSelectionOptions = {theme: '3'}

    // When
    const theme = await createOrSelectTheme(adminSession, flags)

    // Then
    expect(theme?.role).toBe(LIVE_THEME_ROLE)
    expect(renderConfirmationPrompt).toHaveBeenCalled()
  })

  test('returns undefined if live theme confirmation prompt is not confirmed', async () => {
    // Given
    vi.mocked(findOrSelectTheme).mockResolvedValue(buildTheme({id: 3, name: 'Live Theme', role: LIVE_THEME_ROLE})!)
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(false)
    const flags: ThemeSelectionOptions = {live: true}

    // When
    const theme = await createOrSelectTheme(adminSession, flags)

    // Then
    expect(theme).toBeUndefined()
  })

  test('returns undefined if confirmation prompt is rejected', async () => {
    // Given
    vi.mocked(findOrSelectTheme).mockResolvedValue(buildTheme({id: 3, name: 'Live Theme', role: LIVE_THEME_ROLE})!)
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(false)
    const flags = {live: true}

    // When
    const theme = await createOrSelectTheme(adminSession, flags)

    // Then
    expect(theme).toBeUndefined()
  })

  test('renders text prompt if unpublished flag is provided and theme flag is not provided', async () => {
    // Given
    const flags = {unpublished: true}

    // When
    await createOrSelectTheme(adminSession, flags)

    // Then
    expect(promptThemeName).toHaveBeenCalledWith('Name of the new theme')
  })
})
