export const STORE_AUTH_APP_CLIENT_ID = 'b16de5d7ba3e2e22279a38c22ef025a0'
export const DEFAULT_STORE_AUTH_PORT = 13387
export const STORE_AUTH_CALLBACK_PATH = '/auth/callback'

export function storeAuthRedirectUri(port: number): string {
  return `http://127.0.0.1:${port}${STORE_AUTH_CALLBACK_PATH}`
}

export function storeAuthSessionKey(store: string): string {
  return `${STORE_AUTH_APP_CLIENT_ID}::${store}`
}

export function maskToken(token: string): string {
  if (token.length <= 10) return '***'
  return `${token.slice(0, 10)}***`
}
