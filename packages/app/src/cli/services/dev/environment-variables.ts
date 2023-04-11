import {isSpinEnvironment, spinFqdn} from '@shopify/cli-kit/node/context/spin'

export interface GetBackendEnvironmentVariables extends GetDevSharedEnvironmentVariables {
  backendPort: number
}

export async function getBackendEnvironmentVariables(options: GetBackendEnvironmentVariables) {
  return {
    ...(await getDevSharedEnvironmentVariables(options)),
    // SERVER_PORT is the convention Artisan uses
    PORT: `${options.backendPort}`,
    SERVER_PORT: `${options.backendPort}`,
    BACKEND_PORT: `${options.backendPort}`,
  }
}

export interface GetFrontendEnvironmentVariables extends GetDevSharedEnvironmentVariables {
  backendPort: number
  frontendPort: number
}

export async function getFrontendEnvironmentVariables(options: GetFrontendEnvironmentVariables) {
  return {
    ...(await getDevSharedEnvironmentVariables(options)),
    BACKEND_PORT: `${options.backendPort}`,
    PORT: `${options.frontendPort}`,
    FRONTEND_PORT: `${options.frontendPort}`,
    APP_URL: options.hostname,
    APP_ENV: 'development',
    // Note: These are Laravel varaibles for backwards compatibility with 2.0 templates.
    SERVER_PORT: `${options.frontendPort}`,
  }
}

interface GetDevSharedEnvironmentVariables {
  name: string
  apiKey: string
  apiSecret: string
  hostname: string
  scopes: string
  env: NodeJS.ProcessEnv
}

async function getDevSharedEnvironmentVariables(options: GetDevSharedEnvironmentVariables) {
  return {
    ...options.env,
    /**
     * @deprecated Should be removed in the next major version of the CLI.
     * Users should use SHOPIFY_APP_API_KEY instead.
     */
    SHOPIFY_API_KEY: options.apiKey,
    /**
     * @deprecated Should be removed in the next major version of the CLI.
     * Users should use SHOPIFY_APP_API_SECRET instead.
     */
    SHOPIFY_API_SECRET: options.apiSecret,
    /**
     * @deprecated Should be removed in the next major version of the CLI.
     * Users should use SHOPIFY_APP_URL instead.
     */
    HOST: options.hostname,
    /**
     * @deprecated Should be removed in the next major version of the CLI.
     * Users should use SHOPIFY_APP_SCOPES instead.
     */
    SCOPES: options.scopes,
    NODE_ENV: `development`,
    SHOPIFY_APP_NAME: options.name,
    SHOPIFY_APP_API_KEY: options.apiKey,
    SHOPIFY_APP_API_SECRET: options.apiSecret,
    SHOPIFY_APP_SCOPES: options.scopes ?? '',
    SHOPIFY_APP_URL: options.hostname,
    SHOPIFY_APP_AUTH_AUTHORIZATION_PATH: '',
    SHOPIFY_APP_AUTH_CALLBACK_PATH: '',
    ...(isSpinEnvironment() && {
      SHOP_CUSTOM_DOMAIN: `shopify.${await spinFqdn()}`,
    }),
  }
}
