export function parseCookies(cookies: string) {
  const cookiesRecord: {[key: string]: string} = {}

  cookies.split(';').forEach((cookie) => {
    const parts = cookie.match(/(.*?)=(.*)$/) ?? []

    const key = parts[1]?.trim()
    const value = parts[2]?.trim() ?? ''

    if (key) {
      cookiesRecord[key] = value
    }
  })

  return cookiesRecord
}

export function serializeCookies(cookies: {[key: string]: string}) {
  return Object.entries(cookies)
    .map(([key, value]) => `${key}=${value}`)
    .join('; ')
}
