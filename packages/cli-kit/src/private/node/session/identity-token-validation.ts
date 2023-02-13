import {identityFqdn} from '../../../public/node/context/fqdn.js'
import {outputDebug} from '../../../public/node/output.js'
import {shopifyFetch} from '../../../public/node/http.js'
import {cacheFetch} from '../conf-store.js'
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
      } else if (response.status === 404) {
        return err(new AbortError(`The introspection endpoint returned a 404: ${introspectionURL}`))
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
  const introspectionURL = await cacheFetch('identity-introspection-url', getIntrospectionURL, week)
  let result: Result<T, AbortError> = await fn(introspectionURL)
  if (result.isErr()) {
    await cacheFetch('identity-introspection-url', getIntrospectionURL, 0)
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
