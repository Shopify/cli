export function parseCookies(cookies: string) {
  const cookiesRecord: Record<string, string> = {}

  cookies.split(';').forEach((cookie) => {
    const eqIdx = cookie.indexOf('=')
    if (eqIdx === -1) return

    const key = cookie.substring(0, eqIdx).trim()
    const value = cookie.substring(eqIdx + 1).trim()

    if (key) {
      cookiesRecord[key] = value
    }
  })

  return cookiesRecord
}

export function serializeCookies(cookies: Record<string, string>) {
  return Object.entries(cookies)
    .map(([key, value]) => `${key}=${value}`)
    .join('; ')
}
