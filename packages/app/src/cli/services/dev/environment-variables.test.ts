import {getBackendEnvironmentVariables, getFrontendEnvironmentVariables} from './environment-variables.js'
import {describe, test, expect} from 'vitest'

describe('getBackendEnvironmentVariables', () => {
  test('returns the right set of environment variables', async () => {
    await expect(
      getBackendEnvironmentVariables({
        apiKey: 'api-key',
        apiSecret: 'api-secret',
        backendPort: 1234,
        hostname: 'https://my-app-url.com',
        name: 'my-app',
        scopes: 'read_products,write_products',
        env: {},
      }),
    ).resolves.toMatchInlineSnapshot(`
      {
        "BACKEND_PORT": "1234",
        "HOST": "https://my-app-url.com",
        "NODE_ENV": "development",
        "PORT": "1234",
        "SCOPES": "read_products,write_products",
        "SERVER_PORT": "1234",
        "SHOPIFY_API_KEY": "api-key",
        "SHOPIFY_API_SECRET": "api-secret",
        "SHOPIFY_APP_API_KEY": "api-key",
        "SHOPIFY_APP_API_SECRET": "api-secret",
        "SHOPIFY_APP_AUTH_AUTHORIZATION_PATH": "",
        "SHOPIFY_APP_AUTH_CALLBACK_PATH": "",
        "SHOPIFY_APP_NAME": "my-app",
        "SHOPIFY_APP_SCOPES": "read_products,write_products",
        "SHOPIFY_APP_URL": "https://my-app-url.com",
      }
    `)
  })
})

describe('getFrontendEnvironmentVariables', () => {
  test('returns the right set of environment variables', async () => {
    await expect(
      getFrontendEnvironmentVariables({
        apiKey: 'api-key',
        apiSecret: 'api-secret',
        backendPort: 1234,
        frontendPort: 4567,
        hostname: 'https://my-app-url.com',
        name: 'my-app',
        scopes: 'read_products,write_products',
        env: {},
      }),
    ).resolves.toMatchInlineSnapshot(`
      {
        "APP_ENV": "development",
        "APP_URL": "https://my-app-url.com",
        "BACKEND_PORT": "1234",
        "FRONTEND_PORT": "4567",
        "HOST": "https://my-app-url.com",
        "NODE_ENV": "development",
        "PORT": "4567",
        "SCOPES": "read_products,write_products",
        "SERVER_PORT": "4567",
        "SHOPIFY_API_KEY": "api-key",
        "SHOPIFY_API_SECRET": "api-secret",
        "SHOPIFY_APP_API_KEY": "api-key",
        "SHOPIFY_APP_API_SECRET": "api-secret",
        "SHOPIFY_APP_AUTH_AUTHORIZATION_PATH": "",
        "SHOPIFY_APP_AUTH_CALLBACK_PATH": "",
        "SHOPIFY_APP_NAME": "my-app",
        "SHOPIFY_APP_SCOPES": "read_products,write_products",
        "SHOPIFY_APP_URL": "https://my-app-url.com",
      }
    `)
  })
})
