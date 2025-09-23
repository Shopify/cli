import {themeComponent, themesComponent, ensureDirectoryConfirmed} from './theme-ui.js'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {renderConfirmationPrompt, renderError, renderWarning} from '@shopify/cli-kit/node/ui'
import {test, describe, expect, vi} from 'vitest'

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

function theme(id: number) {
  return {id, name: `theme ${id}`} as Theme
}
