import Push, {ThemeSelectionOptions, createOrSelectTheme} from './push.js'
import {DevelopmentThemeManager} from '../../utilities/development-theme-manager.js'
import {ensureThemeStore} from '../../utilities/theme-store.js'
import {findOrSelectTheme} from '../../utilities/theme-selector.js'
import {push} from '../../services/push.js'
import {getDevelopmentTheme, removeDevelopmentTheme, setDevelopmentTheme} from '../../services/local-storage.js'
import {describe, vi, expect, test, beforeEach} from 'vitest'
import {Config} from '@oclif/core'
import {execCLI2} from '@shopify/cli-kit/node/ruby'
import {AdminSession, ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'
import {renderConfirmationPrompt, renderTextPrompt} from '@shopify/cli-kit/node/ui-inputs'
import {DEVELOPMENT_THEME_ROLE, LIVE_THEME_ROLE, UNPUBLISHED_THEME_ROLE} from '@shopify/cli-kit/node/themes/utils'
import {createTheme, fetchTheme} from '@shopify/cli-kit/node/themes/api'

vi.mock('../../services/push.js')
vi.mock('../../utilities/theme-store.js')
vi.mock('../../utilities/theme-selector.js')
vi.mock('../../services/local-storage.js')
vi.mock('@shopify/cli-kit/node/ruby')
vi.mock('@shopify/cli-kit/node/session')
vi.mock('@shopify/cli-kit/node/themes/api')
vi.mock('@shopify/cli-kit/node/ui-inputs')

const CommandConfig = new Config({root: __dirname})

describe('Push', () => {
  const adminSession = {token: '', storeFqdn: ''}
  const path = '/my-theme'

  beforeEach(() => {
    vi.mocked(getDevelopmentTheme).mockImplementation(() => undefined)
    vi.mocked(setDevelopmentTheme).mockImplementation(() => undefined)
    vi.mocked(removeDevelopmentTheme).mockImplementation(() => undefined)
  })

  describe('run with CLI 3 implementation', () => {
    test('should run the CLI 2 implementation if the password flag is provided', async () => {
      // Given
      const theme = buildTheme({id: 1, name: 'Theme', role: 'development'})!
      vi.spyOn(DevelopmentThemeManager.prototype, 'fetch').mockResolvedValue(theme)

      // When
      await runPushCommand(['--password', '123'], path, adminSession)

      // Then
      expectCLI2ToHaveBeenCalledWith(`theme push ${path} --development-theme-id ${theme.id}`)
    })

    test('should pass call the CLI 3 command', async () => {
      // Given
      const theme = buildTheme({id: 1, name: 'Theme', role: 'development'})!
      vi.mocked(findOrSelectTheme).mockResolvedValue(theme)

      // When
      await runPushCommand([], path, adminSession)

      // Then
      expect(execCLI2).not.toHaveBeenCalled()
      expect(push).toHaveBeenCalled()
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
      expect(renderTextPrompt).toHaveBeenCalledWith({
        message: 'Name of the new theme',
        defaultValue: expect.any(String),
      })
    })
  })

  describe('run with CLI 2 implementation', () => {
    test('should pass development theme from local storage to CLI 2', async () => {
      // Given
      const theme = buildTheme({id: 1, name: 'Theme', role: 'development'})!
      vi.spyOn(DevelopmentThemeManager.prototype, 'findOrCreate').mockResolvedValue(theme)
      vi.spyOn(DevelopmentThemeManager.prototype, 'fetch').mockResolvedValue(theme)
      await run([])

      // Then
      expect(DevelopmentThemeManager.prototype.findOrCreate).not.toHaveBeenCalled()
      expect(DevelopmentThemeManager.prototype.fetch).toHaveBeenCalledOnce()
      expectCLI2ToHaveBeenCalledWith(`theme push ${path} --stable --development-theme-id ${theme.id}`)
    })

    test('should pass theme and development theme from local storage to CLI 2', async () => {
      // Given
      const themeId = 2
      const theme = buildTheme({id: 3, name: 'Theme', role: 'development'})!
      vi.spyOn(DevelopmentThemeManager.prototype, 'findOrCreate').mockResolvedValue(theme)
      vi.spyOn(DevelopmentThemeManager.prototype, 'fetch').mockResolvedValue(theme)
      await run([`--theme=${themeId}`])

      // Then
      expectCLI2ToHaveBeenCalledWith(
        `theme push ${path} --theme ${themeId} --stable --development-theme-id ${theme.id}`,
      )
    })

    test('should not pass development theme to CLI 2 if local storage is empty', async () => {
      // When
      await run([])

      // Then
      expect(DevelopmentThemeManager.prototype.findOrCreate).not.toHaveBeenCalled()
      expect(DevelopmentThemeManager.prototype.fetch).toHaveBeenCalledOnce()
      expectCLI2ToHaveBeenCalledWith(`theme push ${path} --stable`)
    })

    test('should pass theme and development theme to CLI 2', async () => {
      // Given
      const theme = buildTheme({id: 4, name: 'Theme', role: 'development'})!
      vi.spyOn(DevelopmentThemeManager.prototype, 'findOrCreate').mockResolvedValue(theme)
      vi.spyOn(DevelopmentThemeManager.prototype, 'fetch').mockResolvedValue(theme)
      await run(['--development'])

      // Then
      expect(DevelopmentThemeManager.prototype.findOrCreate).toHaveBeenCalledOnce()
      expect(DevelopmentThemeManager.prototype.fetch).not.toHaveBeenCalled()
      expectCLI2ToHaveBeenCalledWith(
        `theme push ${path} --stable --theme ${theme.id} --development-theme-id ${theme.id}`,
      )
    })
  })

  async function run(argv: string[]) {
    await runPushCommand(['--stable', ...argv], path, adminSession)
  }

  function expectCLI2ToHaveBeenCalledWith(command: string) {
    expect(execCLI2).toHaveBeenCalledWith(command.split(' '), {
      store: 'example.myshopify.com',
      adminToken: adminSession.token,
    })
  }

  async function runPushCommand(argv: string[], path: string, adminSession: AdminSession) {
    vi.mocked(ensureThemeStore).mockReturnValue('example.myshopify.com')
    vi.mocked(ensureAuthenticatedThemes).mockResolvedValue(adminSession)

    await CommandConfig.load()
    const push = new Push([`--path=${path}`, ...argv], CommandConfig)

    await push.run()
  }
})
