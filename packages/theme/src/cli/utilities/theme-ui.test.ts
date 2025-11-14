import {themeComponent, themesComponent, ensureDirectoryConfirmed, ensureLiveThemeConfirmed} from './theme-ui.js'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {renderConfirmationPrompt, renderError, renderWarning} from '@shopify/cli-kit/node/ui'
import {test, describe, expect, vi, beforeEach} from 'vitest'
import {DEVELOPMENT_THEME_ROLE, LIVE_THEME_ROLE} from '@shopify/cli-kit/node/themes/utils'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'

vi.mock('@shopify/cli-kit/node/ui')

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
    vi.stubGlobal('process', {...process, stdout: {...process.stdout, isTTY: true}})
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

  test('should not prompt for confirmation when called in a non-interactive environment', async () => {
    vi.stubGlobal('process', {...process, stdout: {...process.stdout, isTTY: false}})

    const confirmed = await ensureDirectoryConfirmed(false)

    expect(renderWarning).toHaveBeenCalledWith({
      body: "It doesn't seem like you're running this command in a theme directory.",
    })
    expect(confirmed).toBe(true)
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
    vi.stubGlobal('process', {...process, stdout: {...process.stdout, isTTY: true}})
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
})

function theme(id: number) {
  return {id, name: `theme ${id}`} as Theme
}
