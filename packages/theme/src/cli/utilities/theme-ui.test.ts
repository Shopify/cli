import {
  themeComponent,
  themesComponent,
  ensureDirectoryConfirmed,
  ensureLiveThemeConfirmed,
  ensureLocalFileChangesConfirmed,
} from './theme-ui.js'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {renderConfirmationPrompt, renderError, renderWarning} from '@shopify/cli-kit/node/ui'
import {test, describe, expect, vi, afterEach, beforeEach} from 'vitest'
import {DEVELOPMENT_THEME_ROLE, LIVE_THEME_ROLE} from '@shopify/cli-kit/node/themes/utils'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'

vi.mock('@shopify/cli-kit/node/ui')

beforeEach(() => vi.stubEnv('CI', ''))

afterEach(() => {
  vi.unstubAllGlobals()
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
      stderr: {...process.stderr, isTTY: true},
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
      stderr: {...process.stderr, isTTY: true},
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

describe('ensureLocalFileChangesConfirmed', () => {
  const changes = {overwritten: ['templates/index.json'], deleted: ['assets/old.css', 'assets/older.css']}
  const warning = {
    headline: '',
    body: [
      'Pulling this theme will overwrite 1 local file and delete 2 local files:',
      {list: {items: ['templates/index.json', 'assets/old.css', 'assets/older.css']}},
    ],
  }

  beforeEach(() => {
    vi.stubGlobal('process', {
      ...process,
      stdin: {...process.stdin, isTTY: true},
      stderr: {...process.stderr, isTTY: true},
    })
  })

  test('prompts for confirmation when local files would be overwritten or deleted', async () => {
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(false)

    const confirmed = await ensureLocalFileChangesConfirmed(changes, false)

    expect(renderWarning).toHaveBeenCalledWith(warning)
    expect(renderConfirmationPrompt).toHaveBeenCalledWith({
      message: 'Do you want to proceed?',
      confirmationMessage: 'Yes, update my local files',
      cancellationMessage: 'No, cancel',
    })
    expect(confirmed).toBe(false)
  })

  test('does not prompt when no local files would change', async () => {
    const confirmed = await ensureLocalFileChangesConfirmed({overwritten: [], deleted: []}, false)

    expect(renderWarning).not.toHaveBeenCalled()
    expect(renderConfirmationPrompt).not.toHaveBeenCalled()
    expect(confirmed).toBe(true)
  })

  test('does not prompt when force flag is true', async () => {
    const confirmed = await ensureLocalFileChangesConfirmed(changes, true)

    expect(renderWarning).not.toHaveBeenCalled()
    expect(renderConfirmationPrompt).not.toHaveBeenCalled()
    expect(confirmed).toBe(true)
  })

  test('lists a limited number of files', async () => {
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
    const overwritten = Array.from({length: 12}, (_, index) => `snippets/file-${index}.liquid`)

    await ensureLocalFileChangesConfirmed({overwritten, deleted: []}, false)

    expect(renderWarning).toHaveBeenCalledWith({
      headline: '',
      body: [
        'Pulling this theme will overwrite 12 local files:',
        {list: {items: overwritten.slice(0, 10)}},
        'and 2 more.',
      ],
    })
  })

  test('warns and proceeds when prompting is unavailable', async () => {
    vi.stubEnv('SHOPIFY_FLAG_NO_INPUT', 'true')

    const confirmed = await ensureLocalFileChangesConfirmed(changes, false)

    expect(renderWarning).toHaveBeenCalledWith(warning)
    expect(renderConfirmationPrompt).not.toHaveBeenCalled()
    expect(confirmed).toBe(true)
  })

  test('warns and proceeds during a multi environment command run', async () => {
    const confirmed = await ensureLocalFileChangesConfirmed(changes, false, 'Production', true)

    expect(renderWarning).toHaveBeenCalledWith({...warning, headline: 'Environment: Production'})
    expect(renderConfirmationPrompt).not.toHaveBeenCalled()
    expect(confirmed).toBe(true)
  })
})

describe('ensureLiveThemeConfirmed', () => {
  const theme = buildTheme({id: 123, name: 'My Theme', role: DEVELOPMENT_THEME_ROLE})!
  const liveTheme = buildTheme({id: 123, name: 'My Theme', role: LIVE_THEME_ROLE})!

  beforeEach(() => {
    vi.stubGlobal('process', {
      ...process,
      stdin: {...process.stdin, isTTY: true},
      stderr: {...process.stderr, isTTY: true},
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

  test('allows a live theme with --allow-live when prompting is unavailable', async () => {
    vi.stubEnv('SHOPIFY_FLAG_NO_INPUT', 'true')
    vi.stubGlobal('process', {
      ...process,
      stdin: {...process.stdin, isTTY: false},
      stderr: {...process.stderr, isTTY: false},
    })

    const result = await ensureLiveThemeConfirmed(liveTheme, 'start development mode', true)

    expect(result).toBe(true)
    expect(renderConfirmationPrompt).not.toHaveBeenCalled()
  })

  test.each([
    {name: 'input is disabled', stdin: true, stderr: true, noInput: 'true'},
    {name: 'stdin is redirected', stdin: false, stderr: true},
    {name: 'stderr is redirected', stdin: true, stderr: false},
    {name: 'CI is enabled', stdin: true, stderr: true, ci: 'true'},
  ])('requires --allow-live when $name', async ({stdin, stderr, noInput, ci}) => {
    vi.stubEnv('SHOPIFY_FLAG_NO_INPUT', noInput ?? '')
    vi.stubEnv('CI', ci ?? '')
    vi.stubGlobal('process', {
      ...process,
      stdin: {...process.stdin, isTTY: stdin},
      stdout: {...process.stdout, isTTY: true},
      stderr: {...process.stderr, isTTY: stderr},
    })

    const confirmation = ensureLiveThemeConfirmed(liveTheme, 'start development mode', false)

    await expect(confirmation).rejects.toMatchObject({
      message: "Can't start development mode on the live theme when user input is unavailable.",
      tryMessage: 'Use `--allow-live` to confirm that you want to continue.',
    })
    expect(renderConfirmationPrompt).not.toHaveBeenCalled()
  })
})

function theme(id: number) {
  return {id, name: `theme ${id}`} as Theme
}
