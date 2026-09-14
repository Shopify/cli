import {patchAppRelativeUrls, resolveAppRelativeUrl} from './app_relative_urls.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {describe, expect, test} from 'vitest'

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
  test('resolves all declared relative fields without changing undeclared fields', () => {
    const config = {
      url: '/callback',
      validation_url: '/validate',
      other_url: '/leave-alone',
      name: 'Example extension',
    }

    patchAppRelativeUrls('Test module', ['url', 'validation_url'], config, 'https://my-app.example.com')

    expect(config).toEqual({
      url: 'https://my-app.example.com/callback',
      validation_url: 'https://my-app.example.com/validate',
      other_url: '/leave-alone',
      name: 'Example extension',
    })
  })

  test('leaves absolute URLs untouched without an app URL', () => {
    const config = {url: 'https://my-prod-host.example.com/callback'}

    patchAppRelativeUrls('Test module', ['url'], config, undefined)

    expect(config).toEqual({url: 'https://my-prod-host.example.com/callback'})
  })

  test('leaves configuration untouched when no fields are declared', () => {
    const config = {url: '/callback'}

    patchAppRelativeUrls('Test module', [], config, undefined)

    expect(config).toEqual({url: '/callback'})
  })

  test('leaves missing and non-string fields for schema validation', () => {
    const config = {url: 42, optional_url: undefined}

    patchAppRelativeUrls('Test module', ['url', 'optional_url', 'missing_url'], config, undefined)

    expect(config).toEqual({url: 42, optional_url: undefined})
  })

  test('rejects relative fields that cannot be resolved', () => {
    expect(() => patchAppRelativeUrls('Test module', ['url'], {url: '/callback'}, undefined)).toThrow(AbortError)
  })

  test.each([
    {name: 'newline', character: '\n'},
    {name: 'carriage return', character: '\r'},
    {name: 'tab', character: '\t'},
  ])('rejects relative URL fields containing a $name', ({character}) => {
    const config = {url: `/callback${character}injected-content`}

    expect(() => patchAppRelativeUrls('Test module', ['url'], config, 'https://my-app.example.com')).toThrow(AbortError)
  })
})
