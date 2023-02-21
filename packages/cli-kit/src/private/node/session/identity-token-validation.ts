import {identityFqdn} from '../../../public/node/context/fqdn.js'
import {outputDebug} from '../../../public/node/output.js'
import {shopifyFetch} from '../../../public/node/http.js'
import {cacheRetrieveOrRepopulate, IntrospectionUrlKey} from '../conf-store.js'
import {err, ok, Result} from '../../../public/node/result.js'
import {AbortError} from '../../../public/node/error.js'

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
        return ok(json.valid)
      } else if (response.status === 404 || response.status > 500) {
        // If the status is 404 or 5xx, most likely the introspection endpoint
        // has changed. We should invalidate the cache and try again.
        return err(new AbortError(`The introspection endpoint returned a ${response.status}: ${introspectionURL}`))
      } else {
        const text = await response.text()
        outputDebug(`The Introspection request failed with:
 - status: ${response.status}
 - www-authenticate header: ${JSON.stringify(response.headers.get('www-authenticate'))}
 - body: ${JSON.stringify(text)}`)
        return ok(false)
      }
    })
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    outputDebug(`The identity token is invalid: ${error}`)
    return false
  }
}

async function withIntrospectionURL<T>(fn: (introspectionUrl: string) => Promise<Result<T, AbortError>>): Promise<T> {
  const week = 7 * 24 * 60 * 60 * 1000
  const cacheKey: IntrospectionUrlKey = `identity-introspection-url-${await identityFqdn()}`
  let introspectionURL = await cacheRetrieveOrRepopulate(cacheKey, getIntrospectionURL, week)
  let result: Result<T, AbortError> = await fn(introspectionURL)
  if (result.isErr()) {
    introspectionURL = await cacheRetrieveOrRepopulate(cacheKey, getIntrospectionURL, 0)
    result = await fn(introspectionURL)
  }
  if (result.isErr()) {
    throw result.error
  } else {
    return result.value
  }
}

async function getIntrospectionURL(): Promise<string> {
  const response = await shopifyFetch(`https://${await identityFqdn()}/.well-known/openid-configuration.json`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = await response.json()
  return json.introspection_endpoint
}
