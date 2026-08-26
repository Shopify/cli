import {themeComponent, themesComponent, ensureDirectoryConfirmed, ensureLiveThemeConfirmed} from './theme-ui.js'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {renderConfirmationPrompt, renderError, renderWarning} from '@shopify/cli-kit/node/ui'
import {test, describe, expect, vi, afterEach, beforeEach} from 'vitest'
import {DEVELOPMENT_THEME_ROLE, LIVE_THEME_ROLE} from '@shopify/cli-kit/node/themes/utils'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'

vi.mock('@shopify/cli-kit/node/ui')

beforeEach(() => vi.stubEnv('CI', ''))

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('themeComponent', () => {
  test('returns the ui for a theme', async () => {
    const component = themeComponent(theme(1))

    expect(component).toEqual(["'theme 1'", {subdued: '(#1)'}])
  })
})

describe('themesComponent', () => {
  test('returns the ui for a list of themes', async () => {
    const component = themesComponent([theme(1), theme(2), theme(3)])

    expect(component).toEqual({
      list: {
        items: [
          ["'theme 1'", {subdued: '(#1)'}],
          ["'theme 2'", {subdued: '(#2)'}],
          ["'theme 3'", {subdued: '(#3)'}],
        ],
      },
    })
  })
})

describe('ensureDirectoryConfirmed', () => {
  test('should prompt for confirmation when force flag is false', async () => {
    vi.stubGlobal('process', {
      ...process,
      stdin: {...process.stdin, isTTY: true},
      stdout: {...process.stdout, isTTY: true},
    })
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)

    const confirmed = await ensureDirectoryConfirmed(false)

    expect(renderWarning).toHaveBeenCalledWith({
      body: "It doesn't seem like you're running this command in a theme directory.",
    })
    expect(renderConfirmationPrompt).toHaveBeenCalledWith({
      message: 'Do you want to proceed?',
    })
    expect(confirmed).toBe(true)
  })

  test('preserves existing behavior when called in a non-interactive environment', async () => {
    vi.stubGlobal('process', {
      ...process,
      stdin: {...process.stdin, isTTY: false},
      stdout: {...process.stdout, isTTY: true},
    })

    const confirmed = await ensureDirectoryConfirmed(false)

    expect(renderWarning).toHaveBeenCalledWith({
      body: "It doesn't seem like you're running this command in a theme directory.",
    })
    expect(renderConfirmationPrompt).not.toHaveBeenCalled()
    expect(confirmed).toBe(true)
  })

  test('requires --force when input is explicitly disabled', async () => {
    vi.stubEnv('SHOPIFY_FLAG_NO_INPUT', 'true')

    await expect(ensureDirectoryConfirmed(false)).rejects.toThrow(
      'This command must run from a theme directory when user input is unavailable.',
    )
    expect(renderConfirmationPrompt).not.toHaveBeenCalled()
  })

  describe('during a multi environment command run', () => {
    test('should not prompt for confirmation and display an error', async () => {
      const confirmed = await ensureDirectoryConfirmed(false, undefined, 'Production', true)

      expect(renderError).toHaveBeenCalledWith({
        headline: 'Environment: Production',
        body: "It doesn't seem like you're running this command in a theme directory.",
      })
      expect(confirmed).toBe(false)
    })
  })
})

describe('ensureLiveThemeConfirmed', () => {
  const theme = buildTheme({id: 123, name: 'My Theme', role: DEVELOPMENT_THEME_ROLE})!
  const liveTheme = buildTheme({id: 123, name: 'My Theme', role: LIVE_THEME_ROLE})!

  beforeEach(() => {
    vi.stubGlobal('process', {
      ...process,
      stdin: {...process.stdin, isTTY: true},
      stdout: {...process.stdout, isTTY: true},
    })
  })

  test('prompts for confirmation if acting on a live theme', async () => {
    // Given
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)

    const result = await ensureLiveThemeConfirmed(liveTheme, 'start development mode', false)

    // Then
    expect(renderConfirmationPrompt).toHaveBeenCalledWith({
      message:
        'You\'re about to start development mode on your live theme "My Theme". This will make changes visible to customers. Are you sure you want to proceed?',
      confirmationMessage: 'Yes, proceed with live theme',
      cancellationMessage: 'No, cancel',
    })
    expect(result).toBe(true)
  })

  test('does not prompt for confirmation if acting on a non-live theme', async () => {
    // Given
    await ensureLiveThemeConfirmed(theme, 'start development mode', false)

    // Then
    expect(renderConfirmationPrompt).not.toHaveBeenCalled()
  })

  test('does not prompt for confirmation if acting on a live theme and allowLive flag is true', async () => {
    // Given
    await ensureLiveThemeConfirmed(liveTheme, 'start development mode', true)

    // Then
    expect(renderConfirmationPrompt).not.toHaveBeenCalled()
  })

  test('requires --allow-live when input is disabled', async () => {
    vi.stubEnv('SHOPIFY_FLAG_NO_INPUT', 'true')

    const confirmation = ensureLiveThemeConfirmed(liveTheme, 'start development mode', false)

    await expect(confirmation).rejects.toThrow(
      "Can't start development mode on the live theme when user input is unavailable.",
    )
    expect(renderConfirmationPrompt).not.toHaveBeenCalled()
  })

  test('preserves existing behavior for a live theme in a non-interactive environment', async () => {
    vi.stubGlobal('process', {
      ...process,
      stdin: {...process.stdin, isTTY: false},
      stdout: {...process.stdout, isTTY: true},
    })

    const result = await ensureLiveThemeConfirmed(liveTheme, 'start development mode', false)

    expect(result).toBe(true)
    expect(renderConfirmationPrompt).not.toHaveBeenCalled()
  })
})

function theme(id: number) {
  return {id, name: `theme ${id}`} as Theme
}
