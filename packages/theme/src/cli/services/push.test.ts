import {push} from './push.js'
import {hasRequiredThemeDirectories} from '../utilities/theme-fs.js'
import {uploadTheme} from '../utilities/theme-uploader.js'
import {resolvePath} from '@shopify/cli-kit/node/path'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'
import {test, describe, vi, expect, beforeEach} from 'vitest'
import {fetchChecksums, publishTheme} from '@shopify/cli-kit/node/themes/api'

vi.mock('../utilities/theme-fs.js')
vi.mock('@shopify/cli-kit/node/path')
vi.mock('../utilities/theme-uploader.js')
vi.mock('@shopify/cli-kit/node/themes/api')

describe('push', () => {
  const adminSession = {token: '', storeFqdn: ''}
  const theme = buildTheme({id: 1, name: 'Theme', role: 'development'})!

  beforeEach(() => {
    vi.mocked(uploadTheme).mockResolvedValue(new Map())
  })

  test('should call publishTheme if publish flag is provided', async () => {
    // Given
    const theme = buildTheme({id: 1, name: 'Theme', role: 'development'})!
    vi.mocked(resolvePath).mockReturnValue('/provided/path')
    vi.mocked(hasRequiredThemeDirectories).mockResolvedValue(true)
    vi.mocked(fetchChecksums).mockResolvedValue([])

    // When
    await push(theme, adminSession, {
      publish: true,
      path: '',
      nodelete: false,
      json: false,
      force: false,
    })

    // Then
    expect(publishTheme).toHaveBeenCalledWith(theme.id, adminSession)
  })
})
