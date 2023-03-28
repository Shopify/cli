import {allowedRedirectionURLsPrompt, appUrlPrompt} from './update-url.js'
import {describe, expect, vi, test} from 'vitest'
import {renderTextPrompt} from '@shopify/cli-kit/node/ui'

vi.mock('@shopify/cli-kit/node/ui')

describe('appUrlPrompt', () => {
  test('asks the user to write a URL and returns it', async () => {
    // Given
    vi.mocked(renderTextPrompt).mockResolvedValue('https://my-app.example.com')

    // When
    const got = await appUrlPrompt('https://example.com')

    // Then
    expect(got).toEqual('https://my-app.example.com')
    expect(renderTextPrompt).toHaveBeenCalledWith({
      message: 'App URL',
      defaultValue: 'https://example.com',
      validate: expect.any(Function),
    })
  })
})

describe('allowedRedirectionURLsPrompt', () => {
  test('asks the user to write a URL and returns it', async () => {
    // Given
    vi.mocked(renderTextPrompt).mockResolvedValue('https://example.com/callback1,https://example.com/callback2')

    // When
    const got = await allowedRedirectionURLsPrompt('https://example.com/callback')

    // Then
    expect(got).toEqual(['https://example.com/callback1', 'https://example.com/callback2'])
    expect(renderTextPrompt).toHaveBeenCalledWith({
      message: 'Allowed redirection URLs (comma separated)',
      defaultValue: 'https://example.com/callback',
      validate: expect.any(Function),
    })
  })
})
