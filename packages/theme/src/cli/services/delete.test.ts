import {themesDelete as executeDelete} from './delete.js'
import {renderThemeDeleteResult} from './delete/result.js'
import {removeDevelopmentTheme} from './local-storage.js'
import {findOrSelectTheme, findThemes} from '../utilities/theme-selector.js'
import {themeDelete} from '@shopify/cli-kit/node/themes/api'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {test, describe, expect, vi} from 'vitest'
import {renderConfirmationPrompt, renderSuccess} from '@shopify/cli-kit/node/ui'
import {AbortError} from '@shopify/cli-kit/node/error'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'

vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/themes/api')
vi.mock('./local-storage.js')
vi.mock('../utilities/theme-selector.js')
vi.mock('../utilities/development-theme-manager.js', () => {
  const DevelopmentThemeManager = vi.fn()
  DevelopmentThemeManager.prototype.find = () => theme1
  return {DevelopmentThemeManager}
})

const session = {
  token: 'token',
  storeFqdn: 'my-shop.myshopify.com',
}

const theme1 = {
  id: 1,
  name: 'my theme',
} as Theme

const theme2 = {
  id: 2,
  name: 'another theme',
} as Theme

const options = {
  selectTheme: false,
  development: false,
  force: false,
  themes: [],
}

describe('themesDelete', () => {
  test('deletes the development theme', async () => {
    // Given
    const confirmed = true

    vi.mocked(renderConfirmationPrompt).mockResolvedValue(confirmed)
    vi.mocked(findThemes).mockResolvedValue([theme1])

    // When
    await themesDelete(session, {...options, development: true})

    // Then
    expect(themeDelete).toBeCalledWith(theme1.id, session)
    expect(renderSuccess).toBeCalledWith({
      body: ['The theme', "'my theme'", {subdued: '(#1)'}, 'was deleted from my-shop.myshopify.com.'],
    })
  })

  test('deletes the selected theme', async () => {
    // Given
    const confirmed = true

    vi.mocked(renderConfirmationPrompt).mockResolvedValue(confirmed)
    vi.mocked(findOrSelectTheme).mockResolvedValue(theme1)

    // When
    await themesDelete(session, options)

    // Then
    expect(themeDelete).toBeCalledWith(theme1.id, session)
    expect(renderSuccess).toBeCalledWith({
      body: ['The theme', "'my theme'", {subdued: '(#1)'}, 'was deleted from my-shop.myshopify.com.'],
    })
  })

  test('deletes the many themes', async () => {
    // Given
    const confirmed = true

    vi.mocked(renderConfirmationPrompt).mockResolvedValue(confirmed)
    vi.mocked(findThemes).mockResolvedValue([theme1, theme2])

    // When
    await themesDelete(session, {...options, themes: ['my theme', '2']})

    // Then
    expect(themeDelete).toBeCalledWith(theme1.id, session)
    expect(themeDelete).toBeCalledWith(theme2.id, session)
    expect(renderSuccess).toBeCalledWith({
      body: [
        'The following themes were deleted from my-shop.myshopify.com:',
        {
          list: {
            items: [
              ["'my theme'", {subdued: '(#1)'}],
              ["'another theme'", {subdued: '(#2)'}],
            ],
          },
        },
      ],
    })
  })

  test('deletes themes without confirmation with the force flag is passed', async () => {
    // Given
    const confirmed = false

    vi.mocked(renderConfirmationPrompt).mockResolvedValue(confirmed)
    vi.mocked(findThemes).mockResolvedValue([theme1, theme2])

    // When
    await themesDelete(session, {...options, force: true, themes: ['my theme', '2']})

    // Then
    expect(themeDelete).toBeCalledWith(theme1.id, session)
    expect(themeDelete).toBeCalledWith(theme2.id, session)
    expect(renderSuccess).toBeCalledWith({
      body: [
        'The following themes were deleted from my-shop.myshopify.com:',
        {
          list: {
            items: [
              ["'my theme'", {subdued: '(#1)'}],
              ["'another theme'", {subdued: '(#2)'}],
            ],
          },
        },
      ],
    })
  })

  test("doesn't delete any theme when options is not confirmed", async () => {
    // Given
    const confirmed = false

    vi.mocked(renderConfirmationPrompt).mockResolvedValue(confirmed)
    vi.mocked(findThemes).mockResolvedValue([theme1, theme2])

    // When
    await themesDelete(session, {...options, themes: ['my theme', '2']})

    // Then
    expect(themeDelete).not.toBeCalled()
    expect(renderSuccess).not.toBeCalled()
  })
})

async function themesDelete(...args: Parameters<typeof executeDelete>) {
  const result = await executeDelete(...args)
  if (result) renderThemeDeleteResult(result, 'text', {store: args[0].storeFqdn})
  return result
}

test('returns deletion data without presenting it', async () => {
  vi.mocked(findThemes).mockResolvedValue([theme1, theme2])
  const result = await executeDelete(session, {...options, themes: ['1', '2'], force: true})
  expect(result).toEqual({
    status: 'success',
    themes: [theme1, theme2].map((theme) => ({...theme, shop: session.storeFqdn})),
  })
  expect(renderSuccess).not.toHaveBeenCalled()
})

test('does not prompt again for multiple environments', async () => {
  vi.mocked(findThemes).mockResolvedValue([theme1])
  await executeDelete(session, {...options, themes: ['1']}, true)
  expect(renderConfirmationPrompt).not.toHaveBeenCalled()
  expect(themeDelete).toHaveBeenCalledWith(1, session)
})

test.each([false, true])('preserves remote deletions when local cleanup fails (multiple: %s)', async (multiple) => {
  const output = mockAndCaptureOutput()
  const developmentTheme = {...theme1, role: 'development'}
  const themes = multiple ? [developmentTheme, theme2] : [developmentTheme]
  vi.mocked(findThemes).mockResolvedValue(themes)
  vi.mocked(removeDevelopmentTheme).mockImplementation(() => {
    throw new AbortError('Local storage is not writable')
  })

  const result = await executeDelete(session, {...options, themes: ['1', '2'], force: true})

  expect(result).toEqual({
    status: 'success',
    themes: themes.map((theme) => ({...theme, shop: session.storeFqdn})),
  })
  expect(output.warn()).toContain(
    'Theme #1 was deleted, but its local development theme reference could not be removed',
  )
  expect(output.warn()).toContain('Local storage is not writable')
})

test('does not remove local state when remote deletion fails', async () => {
  vi.mocked(findThemes).mockResolvedValue([{...theme1, role: 'development'}])
  vi.mocked(themeDelete).mockRejectedValue(new Error('Deletion failed'))

  await expect(executeDelete(session, {...options, themes: ['1'], force: true})).rejects.toThrow('Deletion failed')

  expect(removeDevelopmentTheme).not.toHaveBeenCalled()
})

test.each([false, true])('preserves the first fatal error when all deletions fail (multiple: %s)', async (multiple) => {
  const error = new AbortError('Missing theme access scope', 'Check the access token scopes.', [
    'Request the required theme access scope.',
  ])
  error.code = 'MISSING_THEME_SCOPE'
  error.customSections = [{title: 'Required access', body: 'write_themes'}]
  error.details = {requiredScope: 'write_themes'}
  vi.mocked(findThemes).mockResolvedValue(multiple ? [theme1, theme2] : [theme1])
  vi.mocked(themeDelete).mockRejectedValueOnce(error).mockRejectedValueOnce(new Error('Another deletion failed'))

  await expect(executeDelete(session, {...options, themes: ['1', '2'], force: true})).rejects.toBe(error)
  expect(error.details).toEqual({requiredScope: 'write_themes'})
})

test('includes each theme failure when ordinary errors cause total failure', async () => {
  vi.mocked(findThemes).mockResolvedValue([theme1, theme2])
  vi.mocked(themeDelete)
    .mockRejectedValueOnce(new Error('First deletion failed'))
    .mockRejectedValueOnce(new Error('Second deletion failed'))

  await expect(executeDelete(session, {...options, themes: ['1', '2'], force: true})).rejects.toMatchObject({
    message: 'First deletion failed',
    details: {
      errors: [
        {themeId: '1', message: 'First deletion failed'},
        {themeId: '2', message: 'Second deletion failed'},
      ],
    },
  })
})

test('preserves the environment label in terminal output', () => {
  renderThemeDeleteResult({status: 'success', themes: [{...theme1, shop: session.storeFqdn}]}, 'text', {
    store: session.storeFqdn,
    environment: ['staging'],
  })
  expect(renderSuccess).toHaveBeenCalledWith({
    body: [
      {subdued: 'Environment: staging\n\n'},
      'The theme',
      "'my theme'",
      {subdued: '(#1)'},
      'was deleted from my-shop.myshopify.com.',
    ],
  })
})
