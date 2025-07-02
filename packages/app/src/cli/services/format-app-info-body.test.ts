import {formatAppInfoBody} from './format-app-info-body.js'
import {describe, expect, test} from 'vitest'

describe('formatAppInfoBody', () => {
  test('formats app info with all options provided', () => {
    // Given
    const options = {
      appName: 'My Test App',
      appURL: 'https://my-app.ngrok.io',
      configPath: '/Users/dev/my-app/shopify.app.toml',
      shopFqdn: 'test-store.myshopify.com',
      organizationName: 'My Organization',
    }

    // When
    const result = formatAppInfoBody(options)

    // Then
    expect(result).toEqual([
      {
        list: {
          items: [
            'App:             My Test App',
            'App URL:         https://my-app.ngrok.io',
            'App config:      shopify.app.toml',
            'Dev store:       test-store.myshopify.com',
            'Org:             My Organization',
          ],
        },
      },
      '\n',
      "Press 'i' or 'escape' to close",
    ])
  })

  test('formats app info with minimal required fields only', () => {
    // Given
    const options = {
      shopFqdn: 'test-store.myshopify.com',
    }

    // When
    const result = formatAppInfoBody(options)

    // Then
    expect(result).toEqual([
      {
        list: {
          items: ['Dev store:       test-store.myshopify.com'],
        },
      },
      '\n',
      "Press 'i' or 'escape' to close",
    ])
  })

  test('formats app info with some optional fields missing', () => {
    // Given
    const options = {
      appName: 'My Test App',
      configPath: '/path/to/config/shopify.app.production.toml',
      shopFqdn: 'test-store.myshopify.com',
    }

    // When
    const result = formatAppInfoBody(options)

    // Then
    expect(result).toEqual([
      {
        list: {
          items: [
            'App:             My Test App',
            'App config:      shopify.app.production.toml',
            'Dev store:       test-store.myshopify.com',
          ],
        },
      },
      '\n',
      "Press 'i' or 'escape' to close",
    ])
  })

  test('extracts filename from config path correctly', () => {
    // Given
    const options = {
      configPath: '/very/long/path/to/nested/directories/my-config.toml',
      shopFqdn: 'test-store.myshopify.com',
    }

    // When
    const result = formatAppInfoBody(options)

    // Then
    expect(result).toEqual([
      {
        list: {
          items: ['App config:      my-config.toml', 'Dev store:       test-store.myshopify.com'],
        },
      },
      '\n',
      "Press 'i' or 'escape' to close",
    ])
  })

  test('handles empty or undefined optional fields gracefully', () => {
    // Given
    const options = {
      appName: '',
      appURL: undefined,
      configPath: '',
      shopFqdn: 'test-store.myshopify.com',
      organizationName: null as any,
    }

    // When
    const result = formatAppInfoBody(options)

    // Then
    expect(result).toEqual([
      {
        list: {
          items: ['Dev store:       test-store.myshopify.com'],
        },
      },
      '\n',
      "Press 'i' or 'escape' to close",
    ])
  })
})
