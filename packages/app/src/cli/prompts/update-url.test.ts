import {allowedRedirectionURLsPrompt, appUrlPrompt} from './update-url.js'
import {describe, it, expect, vi, beforeEach} from 'vitest'
import {ui} from '@shopify/cli-kit'

beforeEach(() => {
  vi.mock('@shopify/cli-kit', async () => {
    const cliKit: any = await vi.importActual('@shopify/cli-kit')
    return {
      ...cliKit,
      ui: {
        prompt: vi.fn(),
      },
    }
  })
})

describe('appUrlPrompt', () => {
  it('asks the user to write a URL and returns it', async () => {
    // Given
    vi.mocked(ui.prompt).mockResolvedValue({url: 'https://my-app.example.com'})

    // When
    const got = await appUrlPrompt('https://example.com')

    // Then
    expect(got).toEqual('https://my-app.example.com')
    expect(ui.prompt).toHaveBeenCalledWith([
      {
        type: 'input',
        name: 'url',
        message: 'App URL',
        default: 'https://example.com',
        validate: expect.any(Function),
      },
    ])
  })
})

describe('allowedRedirectionURLsPrompt', () => {
  it('asks the user to write a URL and returns it', async () => {
    // Given
    vi.mocked(ui.prompt).mockResolvedValue({urls: 'https://example.com/callback1,https://example.com/callback2'})

    // When
    const got = await allowedRedirectionURLsPrompt('https://example.com/callback')

    // Then
    expect(got).toEqual(['https://example.com/callback1', 'https://example.com/callback2'])
    expect(ui.prompt).toHaveBeenCalledWith([
      {
        type: 'input',
        name: 'urls',
        message: 'Allowed redirection URLs (comma separated)',
        default: 'https://example.com/callback',
        validate: expect.any(Function),
      },
    ])
  })
})
