export function parseCookies(cookies: string) {
  const cookiesRecord: Record<string, string> = {}

  cookies.split(';').forEach((cookie) => {
    const parts = cookie.match(/(.*?)=(.*)$/) ?? []

    const key = parts[1]?.trim()
    const name = parts[2]?.trim() ?? ''

    if (key) {
      cookiesRecord[key] = name
    }
  })

  return cookiesRecord
}

export function serializeCookies(cookies: Record<string, string>) {
  return Object.entries(cookies)
    .map(([key, value]) => `${key}=${value}`)
    .join('; ')
}
