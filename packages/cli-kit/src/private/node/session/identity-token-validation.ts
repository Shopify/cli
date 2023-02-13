import {identityFqdn} from '../../../public/node/context/fqdn.js'
import {outputDebug} from '../../../public/node/output.js'
import {shopifyFetch} from '../../../public/node/http.js'
import {cacheFetch} from '../conf-store.js'

class NotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
  }
}

export async function validateIdentityToken(token: string): Promise<boolean> {
  try {
    return withIntrospectionURL<boolean>(async (introspectionURL: string) => {
      const options = {
        method: 'POST',
        headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
        body: JSON.stringify({token}),
      }
      outputDebug(`Sending Identity Introspection request to URL: ${introspectionURL}`)

      const response = await shopifyFetch(introspectionURL, options)

      if (response.ok && response.headers.get('content-type')?.includes('json')) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const json: any = await response.json()
        outputDebug(`The identity token is valid: ${json.valid}`)
        return json.valid
      } else if (response.status === 404) {
        throw new NotFoundError('Identity Introspection endpoint not found')
      } else {
        const text = await response.text()
        outputDebug(`The Introspection request failed with:
 - status: ${response.status}
 - www-authenticate header: ${JSON.stringify(response.headers.get('www-authenticate'))}
 - body: ${JSON.stringify(text)}`)
        return false
      }
    })
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    outputDebug(`The identity token is invalid: ${error}`)
    return false
  }
}

async function withIntrospectionURL<T>(fn: (introspectionUrl: string) => Promise<T>): Promise<T> {
  const week = 7 * 24 * 60 * 60 * 1000
  const introspectionURL = await cacheFetch('identity-introspection-url', getIntrospectionURL, week)
  try {
    return fn(introspectionURL)
  } catch (error) {
    if (error instanceof NotFoundError) {
      // If the introspection URL is invalid, clear the cache and try again
      await cacheFetch('identity-introspection-url', getIntrospectionURL, 0)
      return fn(introspectionURL)
    } else {
      throw error
    }
  }
}

async function getIntrospectionURL(): Promise<string> {
  const response = await shopifyFetch(`https://${await identityFqdn()}/.well-known/openid-configuration.json`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = await response.json()
  return json.introspection_endpoint
}
