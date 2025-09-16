// packages/theme/src/cli/services/duplicate.test.ts
import {duplicate} from './duplicate.js'
import {findThemeById, findOrSelectTheme} from '../utilities/theme-selector.js'
import {themeComponent} from '../utilities/theme-ui.js'
import {configureCLIEnvironment} from '../utilities/cli-config.js'
import {themeDuplicate} from '@shopify/cli-kit/node/themes/api'
import {renderConfirmationPrompt, renderError, renderSuccess} from '@shopify/cli-kit/node/ui'
import {outputResult} from '@shopify/cli-kit/node/output'
import {isCI} from '@shopify/cli-kit/node/system'
import {vi, describe, test, expect, beforeEach} from 'vitest'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {AdminSession} from '@shopify/cli-kit/node/session'

vi.mock('@shopify/cli-kit/node/system')
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/themes/api')
vi.mock('@shopify/cli-kit/node/output')
vi.mock('../utilities/theme-selector.js')
vi.mock('../utilities/theme-ui.js')
vi.mock('../utilities/cli-config.js')

const session: AdminSession = {
  token: 'token',
  storeFqdn: 'my-shop.myshopify.com',
}

const theme = {
  id: 1,
  name: 'my theme',
  role: 'unpublished',
} as Theme

const duplicatedTheme = {
  id: 2,
  name: 'my theme copy',
  role: 'unpublished',
} as Theme

const options = {
  theme: '1',
  json: false,
}

describe('duplicate', () => {
  beforeEach(() => {
    vi.mocked(themeComponent).mockReturnValue(['theme component'])
    vi.mocked(configureCLIEnvironment).mockReturnValue()
    vi.mocked(outputResult).mockReturnValue()
  })

  test('prompts for confirmation and duplicates the theme', async () => {
    // Given
    vi.mocked(isCI).mockReturnValue(false)
    vi.mocked(findThemeById).mockResolvedValue(theme)
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
    vi.mocked(themeDuplicate).mockResolvedValue({
      userErrors: [],
      theme: duplicatedTheme,
      requestId: '12345-abcde-67890',
    })

    // When
    await duplicate(session, '1', options)

    // Then
    expect(renderConfirmationPrompt).toHaveBeenCalledWith({
      message: `Do you want to duplicate 'my theme' on my-shop.myshopify.com?`,
      confirmationMessage: `Yes, duplicate 'my theme'`,
      cancellationMessage: 'No, cancel duplicate',
    })
    expect(themeDuplicate).toHaveBeenCalledWith(1, undefined, session)
    expect(renderSuccess).toHaveBeenCalled()
  })

  test('does not duplicate when prompted to cancel', async () => {
    // Given
    vi.mocked(isCI).mockReturnValue(false)
    vi.mocked(findThemeById).mockResolvedValue(theme)
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(false)

    // When
    await duplicate(session, '1', options)

    // Then
    expect(renderConfirmationPrompt).toHaveBeenCalledWith({
      message: `Do you want to duplicate 'my theme' on my-shop.myshopify.com?`,
      confirmationMessage: `Yes, duplicate 'my theme'`,
      cancellationMessage: 'No, cancel duplicate',
    })
    expect(themeDuplicate).not.toHaveBeenCalled()
  })

  test('does not prompt for confirmation when using --force', async () => {
    // Given
    vi.mocked(isCI).mockReturnValue(false)
    vi.mocked(findThemeById).mockResolvedValue(theme)
    vi.mocked(themeDuplicate).mockResolvedValue({
      userErrors: [],
      theme: duplicatedTheme,
      requestId: '12345-abcde-67890',
    })

    // When
    await duplicate(session, '1', {...options, force: true})

    // Then
    expect(renderConfirmationPrompt).not.toHaveBeenCalled()
    expect(renderSuccess).toHaveBeenCalled()
  })

  test('does not prompt for confirmation in CI environment', async () => {
    // Given
    vi.mocked(isCI).mockReturnValue(true)
    vi.mocked(findThemeById).mockResolvedValue(theme)
    vi.mocked(themeDuplicate).mockResolvedValue({
      userErrors: [],
      theme: duplicatedTheme,
      requestId: '12345-abcde-67890',
    })

    // When
    await duplicate(session, '1', options)

    // Then
    expect(renderConfirmationPrompt).not.toHaveBeenCalled()
    expect(renderSuccess).toHaveBeenCalled()
  })

  test('prompts for theme selection when no theme ID is provided', async () => {
    // Given
    vi.mocked(isCI).mockReturnValue(false)
    vi.mocked(findOrSelectTheme).mockResolvedValue(theme)
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
    vi.mocked(themeDuplicate).mockResolvedValue({
      userErrors: [],
      theme: duplicatedTheme,
      requestId: '12345-abcde-67890',
    })

    // When
    await duplicate(session, undefined, options)

    // Then
    expect(findOrSelectTheme).toHaveBeenCalledWith(session, {
      header: 'Select a theme to duplicate',
      filter: {
        theme: undefined,
      },
    })
    expect(renderConfirmationPrompt).toHaveBeenCalled()
  })

  test('requires theme ID in CI environments', async () => {
    // Given
    vi.mocked(isCI).mockReturnValue(true)

    // When
    await duplicate(session, undefined, options)

    // Then
    expect(renderError).toHaveBeenCalledWith({
      body: ['A theme ID is required to duplicate a theme, specify one with the --theme flag'],
    })
    expect(themeDuplicate).not.toHaveBeenCalled()
  })

  test('requires theme ID when force flag is used', async () => {
    // Given
    vi.mocked(isCI).mockReturnValue(false)

    // When
    await duplicate(session, undefined, {...options, force: true})

    // Then
    expect(renderError).toHaveBeenCalledWith({
      body: ['A theme ID is required to duplicate a theme, specify one with the --theme flag'],
    })
    expect(themeDuplicate).not.toHaveBeenCalled()
  })

  test('renders error when theme not found', async () => {
    // Given
    vi.mocked(isCI).mockReturnValue(true)
    vi.mocked(findThemeById).mockResolvedValue(undefined)

    // When
    await duplicate(session, '1', options)

    // Then
    expect(renderError).toHaveBeenCalled()
    expect(themeDuplicate).not.toHaveBeenCalled()
  })

  test('renders error when theme is a development theme', async () => {
    // Given
    vi.mocked(isCI).mockReturnValue(true)
    vi.mocked(findThemeById).mockResolvedValue({...theme, role: 'development'})

    // When
    await duplicate(session, '1', options)

    // Then
    expect(renderError).toHaveBeenCalledWith({
      body: ["Development themes can't be duplicated. Use shopify theme push to upload it to the store first."],
    })
    expect(themeDuplicate).not.toHaveBeenCalled()
  })

  test('uses name parameter when provided', async () => {
    // Given
    vi.mocked(isCI).mockReturnValue(true)
    vi.mocked(findThemeById).mockResolvedValue(theme)
    vi.mocked(themeDuplicate).mockResolvedValue({
      userErrors: [],
      theme: duplicatedTheme,
      requestId: '12345-abcde-67890',
    })

    // When
    await duplicate(session, '1', {...options, name: 'I have a new name now!'})

    // Then
    expect(themeDuplicate).toHaveBeenCalledWith(1, 'I have a new name now!', session)
  })

  test('displays error message when theme cannot be duplicated', async () => {
    // Given
    vi.mocked(isCI).mockReturnValue(true)
    vi.mocked(findThemeById).mockResolvedValue(theme)
    vi.mocked(themeDuplicate).mockResolvedValue({
      userErrors: [{message: 'Some error occurred'}],
      theme: undefined,
      requestId: '12345-abcde-67890',
    })

    // When
    await duplicate(session, '1', options)

    // Then
    expect(renderError).toHaveBeenCalledWith({
      body: [
        'The theme',
        'theme component',
        'could not be duplicated due to errors: ',
        {subdued: 'Some error occurred'},
        {char: '.'},
        '\nRequest ID: ',
        {subdued: '12345-abcde-67890'},
      ],
    })
  })

  test('display JSON error when using --json flag and theme cannot be duplicated', async () => {
    // Given
    vi.mocked(isCI).mockReturnValue(true)
    vi.mocked(findThemeById).mockResolvedValue(theme)
    vi.mocked(themeDuplicate).mockResolvedValue({
      userErrors: [],
      requestId: '12345-abcde-67890',
      theme: undefined,
    })

    // When
    await duplicate(session, '1', {...options, json: true})

    // Then
    expect(outputResult).toHaveBeenCalledWith(
      JSON.stringify({
        message: `The theme '${theme.name}' unexpectedly could not be duplicated `,
        errors: [],
        requestId: '12345-abcde-67890',
      }),
    )
  })
})
