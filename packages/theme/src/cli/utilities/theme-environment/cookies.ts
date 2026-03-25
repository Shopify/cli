export function parseCookies(cookies: string) {
  const cookiesRecord: Record<string, string> = {}

  let start = 0
  let end = cookies.indexOf(';')

  while (end !== -1) {
    const cookie = cookies.substring(start, end)
    const eqIdx = cookie.indexOf('=')
    if (eqIdx !== -1) {
      const key = cookie.substring(0, eqIdx).trim()
      const value = cookie.substring(eqIdx + 1).trim()
      if (key) {
        cookiesRecord[key] = value
      }
    }
    start = end + 1
    end = cookies.indexOf(';', start)
  }

  // Process the last cookie (or only cookie if no semicolons)
  if (start < cookies.length) {
    const cookie = cookies.substring(start)
    const eqIdx = cookie.indexOf('=')
    if (eqIdx !== -1) {
      const key = cookie.substring(0, eqIdx).trim()
      const value = cookie.substring(eqIdx + 1).trim()
      if (key) {
        cookiesRecord[key] = value
      }
    }
  }

  return cookiesRecord
}

export function serializeCookies(cookies: Record<string, string>) {
  return Object.entries(cookies)
    .map(([key, value]) => `${key}=${value}`)
    .join('; ')
}
