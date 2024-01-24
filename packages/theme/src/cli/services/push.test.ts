import {push} from './push.js'
import {hasRequiredThemeDirectories} from '../utilities/theme-fs.js'
import {cwd, resolvePath} from '@shopify/cli-kit/node/path'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'
import {test, describe, vi} from 'vitest'

vi.mock('../utilities/theme-fs.js')
vi.mock('@shopify/cli-kit/node/path')

describe('push', () => {
  const adminSession = {token: '', storeFqdn: ''}
  const theme = buildTheme({id: 1, name: 'Theme', role: 'development'})!

  test('should raise an error if the provided path is not a valid theme directory', async ({expect}) => {
    vi.mocked(resolvePath).mockReturnValue('/invalid/path')
    vi.mocked(hasRequiredThemeDirectories).mockResolvedValue(false)
    await expect(push(theme, adminSession, {path: '/invalid/path'})).rejects.toThrow(
      new Error('Invalid theme directory: /invalid/path'),
    )
  })

  test('should use the current working directory if no path is provided', async ({expect}) => {
    vi.mocked(cwd).mockReturnValue('/current/working/directory')
    vi.mocked(hasRequiredThemeDirectories).mockResolvedValue(true)

    await push(theme, adminSession, {})
    expect(hasRequiredThemeDirectories).toBeCalledWith('/current/working/directory')
  })

  test('should use the provided path if it is provided', async ({expect}) => {
    vi.mocked(resolvePath).mockReturnValue('/provided/path')
    vi.mocked(hasRequiredThemeDirectories).mockResolvedValue(true)

    await push(theme, adminSession, {path: '/provided/path'})
    expect(hasRequiredThemeDirectories).toBeCalledWith('/provided/path')
  })

  test('should throw an error if the working directory does not have the required structure', async ({expect}) => {
    vi.mocked(cwd).mockReturnValue('/current/working/directory')
    vi.mocked(hasRequiredThemeDirectories).mockResolvedValue(false)

    await expect(push(theme, adminSession, {})).rejects.toThrow(
      new Error('Invalid theme directory: /current/working/directory'),
    )
  })
})
