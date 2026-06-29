export {STORE_AUTH_APP_CLIENT_ID} from '@shopify/cli-kit/node/constants'
export {storeAuthSessionKey} from '@shopify/cli-kit/node/store-auth-session'

export const DEFAULT_STORE_AUTH_PORT = 13387
export const STORE_AUTH_CALLBACK_PATH = '/auth/callback'

export function storeAuthRedirectUri(port: number): string {
  return `http://127.0.0.1:${port}${STORE_AUTH_CALLBACK_PATH}`
}

export function maskToken(token: string): string {
  if (token.length <= 10) return '***'
  return `${token.slice(0, 10)}***`
}
