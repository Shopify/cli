import {createOrSelectTheme, push} from './push.js'
import {PullFlags} from './pull.js'
import {uploadTheme} from '../utilities/theme-uploader.js'
import {ensureThemeStore} from '../utilities/theme-store.js'
import {findOrSelectTheme} from '../utilities/theme-selector.js'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'
import {test, describe, vi, expect, beforeEach} from 'vitest'
import {createTheme, fetchTheme, publishTheme} from '@shopify/cli-kit/node/themes/api'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {promptThemeName, UNPUBLISHED_THEME_ROLE} from '@shopify/cli-kit/node/themes/utils'

vi.mock('../utilities/theme-fs.js')
vi.mock('../utilities/theme-uploader.js')
vi.mock('../utilities/theme-store.js')
vi.mock('../utilities/theme-selector.js')
vi.mock('@shopify/cli-kit/node/themes/utils')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/path')
vi.mock('@shopify/cli-kit/node/themes/api')

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

describe('createOrSelectTheme', () => {
  test('creates unpublished theme when unpublished flag is provided', async () => {
    // Given
    vi.mocked(createTheme).mockResolvedValue(buildTheme({id: 2, name: 'Theme', role: UNPUBLISHED_THEME_ROLE}))
    vi.mocked(fetchTheme).mockResolvedValue(undefined)
    vi.mocked(promptThemeName).mockResolvedValue('Theme')

    const flags = {unpublished: true}

    // When
    const theme = await createOrSelectTheme(adminSession, flags)

    // Then
    expect(createTheme).toHaveBeenCalledWith({name: 'Theme', role: UNPUBLISHED_THEME_ROLE}, adminSession)
    expect(theme).toMatchObject({role: UNPUBLISHED_THEME_ROLE})
  })
})
