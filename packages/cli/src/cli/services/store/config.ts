export const STORE_AUTH_APP_CLIENT_ID = '4c6af92692662b9c95c8a47b1520aced'
export const DEFAULT_STORE_AUTH_PORT = 3458
export const STORE_AUTH_CALLBACK_PATH = '/auth/callback'

export function storeAuthRedirectUri(port: number): string {
  return `http://localhost:${port}${STORE_AUTH_CALLBACK_PATH}`
}

export function storeAuthSessionKey(store: string): string {
  return `${STORE_AUTH_APP_CLIENT_ID}::${store}`
}
