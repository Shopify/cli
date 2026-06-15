export const STORE_AUTH_APP_CLIENT_ID = '7e9cb568cfd431c538f36d1ad3f2b4f6'
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
