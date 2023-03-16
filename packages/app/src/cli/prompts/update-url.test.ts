import {allowedRedirectionURLsPrompt, appProxyPathPrompt, appProxyUrlPrompt, appUrlPrompt} from './update-url.js'
import {describe, it, expect, vi} from 'vitest'
import {renderTextPrompt} from '@shopify/cli-kit/node/ui'

vi.mock('@shopify/cli-kit/node/ui')

describe('appUrlPrompt', () => {
  it('asks the user to write a URL and returns it', async () => {
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
  it('asks the user to write a URL and returns it', async () => {
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

describe('appProxyUrlPrompt', () => {
  it('asks the user to write a URL and returns it', async () => {
    // Given
    vi.mocked(renderTextPrompt).mockResolvedValue('https://my-app.example.com')

    // When
    const got = await appProxyUrlPrompt('https://example.com')

    // Then
    expect(got).toEqual('https://my-app.example.com')
    expect(renderTextPrompt).toHaveBeenCalledWith({
      message: 'App Proxy URL',
      defaultValue: 'https://example.com',
      validate: expect.any(Function),
    })
  })
})

describe('appProxyPathPrompt', () => {
  it('asks the user to write a path and returns it', async () => {
    // Given
    vi.mocked(renderTextPrompt).mockResolvedValue('new-path')

    // When
    const got = await appProxyPathPrompt('path')

    // Then
    expect(got).toEqual('new-path')
    expect(renderTextPrompt).toHaveBeenCalledWith({
      message: 'App Proxy Path',
      defaultValue: 'path',
      validate: expect.any(Function),
    })
  })
})
