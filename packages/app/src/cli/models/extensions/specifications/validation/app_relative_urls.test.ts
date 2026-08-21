import {patchAppRelativeUrls, resolveAppRelativeUrl} from './app_relative_urls.js'
import {describe, expect, test} from 'vitest'

const LIFECYCLE_CALLBACK = 'flow_trigger_lifecycle_callback'

describe('resolveAppRelativeUrl', () => {
  const resolve = (url: string, appUrl: string | undefined) => resolveAppRelativeUrl('Test module', 'url', url, appUrl)

  test('returns absolute URLs unchanged', () => {
    expect(resolve('https://my-prod-host.example.com/api/execute', 'https://my-app.example.com')).toBe(
      'https://my-prod-host.example.com/api/execute',
    )
  })

  test('accepts absolute HTTPS URLs regardless of scheme casing', () => {
    expect(resolve('HTTPS://my-prod-host.example.com/api/execute', 'https://my-app.example.com')).toBe(
      'HTTPS://my-prod-host.example.com/api/execute',
    )
  })

  test('prepends the app URL to relative URLs', () => {
    expect(resolve('/api/execute', 'https://my-app.example.com/')).toBe('https://my-app.example.com/api/execute')
  })

  test('throws when a relative URL cannot be resolved without an app URL', () => {
    expect(() => resolve('/api/execute', undefined)).toThrow(
      'Test module url is a relative URL, but no application_url is configured. Set application_url in your app configuration or use an absolute HTTPS URL.',
    )
  })

  test('throws when an absolute URL is not HTTPS', () => {
    expect(() => resolve('http://my-prod-host.example.com/api/execute', undefined)).toThrow(
      'Test module url must resolve to an HTTPS URL. Set application_url to an HTTPS URL or use an absolute HTTPS URL.',
    )
  })

  test('throws when the URL is empty', () => {
    expect(() => resolve('', 'https://my-app.example.com')).toThrow(
      'Test module url must resolve to an HTTPS URL. Set application_url to an HTTPS URL or use an absolute HTTPS URL.',
    )
  })

  test('throws when a relative URL resolves against a non-HTTPS app URL', () => {
    expect(() => resolve('/api/execute', 'http://my-app.example.com')).toThrow(
      'Test module url must resolve to an HTTPS URL. Set application_url to an HTTPS URL or use an absolute HTTPS URL.',
    )
  })

  test('throws on a protocol relative url', () => {
    expect(() => resolve('//evil.example.com/api', 'https://my-app.example.com')).toThrow(
      'Test module url is invalid: a URL relative to the app URL must start with a single slash.',
    )
  })

  test('throws on a url containing control characters', () => {
    expect(() => resolve('/api\nX-Injected: 1', 'https://my-app.example.com')).toThrow(
      'Test module url is invalid: a URL must not contain control characters such as newlines or tabs.',
    )
  })
})

describe('patchAppRelativeUrls', () => {
  const patch = (config: object, appUrl: string | undefined, identifier = LIFECYCLE_CALLBACK) => {
    patchAppRelativeUrls(identifier, config, appUrl)
    return config
  }

  test('prepends the app URL to a relative url', () => {
    // When
    const got = patch({name: 'Auction lifecycle', url: '/api/flow/lifecycle'}, 'https://my-app.example.com')

    // Then
    expect(got).toEqual({name: 'Auction lifecycle', url: 'https://my-app.example.com/api/flow/lifecycle'})
  })

  test('removes a trailing slash from the app URL', () => {
    // When
    const got = patch({url: '/api/flow/lifecycle'}, 'https://my-app.example.com/')

    // Then
    expect(got).toEqual({url: 'https://my-app.example.com/api/flow/lifecycle'})
  })

  test('leaves an absolute url untouched', () => {
    // When
    const got = patch({url: 'https://my-prod-host.example.com/api/flow/lifecycle'}, 'https://my-app.example.com')

    // Then
    expect(got).toEqual({url: 'https://my-prod-host.example.com/api/flow/lifecycle'})
  })

  test('leaves a module with no relative URL fields untouched', () => {
    // When
    const got = patch({url: '/api/something'}, 'https://my-app.example.com', 'some_other_contract_module')

    // Then
    expect(got).toEqual({url: '/api/something'})
  })

  test('throws when there is no app URL to resolve against', () => {
    // When/Then
    expect(() => patch({url: '/api/flow/lifecycle'}, undefined)).toThrow(
      'Flow trigger lifecycle callback url is a relative URL, but no application_url is configured. Set application_url in your app configuration or use an absolute HTTPS URL.',
    )
  })

  test('throws when the app URL is not HTTPS', () => {
    // When/Then
    expect(() => patch({url: '/api/flow/lifecycle'}, 'http://my-app.example.com')).toThrow(
      'Flow trigger lifecycle callback url must resolve to an HTTPS URL.',
    )
  })

  test('throws on a protocol relative url', () => {
    // When/Then
    expect(() => patch({url: '//example.com/api'}, 'https://my-app.example.com')).toThrow(
      'a URL relative to the app URL must start with a single slash',
    )
  })

  test('throws on a url containing control characters', () => {
    // When/Then
    expect(() => patch({url: '/api/flow/lifecycle\nmalicious-header: value'}, 'https://my-app.example.com')).toThrow(
      'a URL must not contain control characters',
    )
  })

  test('resolves against the dev tunnel URL', () => {
    // When
    const got = patch({url: '/api/flow/lifecycle'}, 'https://my-tunnel.example.com')

    // Then
    expect(got).toEqual({url: 'https://my-tunnel.example.com/api/flow/lifecycle'})
  })
})
