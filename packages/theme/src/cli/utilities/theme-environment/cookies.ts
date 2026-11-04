export function parseCookies(cookies: string): Record<string, string> {
  const entries = cookies.split(';').flatMap((cookie) => {
    const [, key, value] = cookie.match(/(.*?)=(.*)$/) ?? []
    const trimmedKey = key?.trim()

    return trimmedKey ? [[trimmedKey, value?.trim() ?? '']] : []
  })

  return Object.fromEntries(entries)
}

export function serializeCookies(cookies: Record<string, string>) {
  return Object.entries(cookies)
    .map(([key, value]) => `${key}=${value}`)
    .join('; ')
}
