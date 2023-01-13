import {identityFqdn} from '../../../environment/fqdn.js'
import {debug} from '../../../output.js'
import {shopifyFetch} from '../../../http.js'

export async function validateIdentityToken(token: string) {
  try {
    const instrospectionURL = await getInstrospectionEndpoint()
    const options = {
      method: 'POST',
      headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
      body: JSON.stringify({token}),
    }
    debug(`Sending Identity Introspection request to URL: ${instrospectionURL}`)

    const response = await shopifyFetch(instrospectionURL, options)

    if (response.ok && response.headers.get('content-type')?.includes('json')) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await response.json()
      debug(`The identity token is valid: ${json.valid}`)
      return json.valid
    } else {
      const text = await response.text()
      debug(`The Introspection request failed with:
 - status: ${response.status}
 - www-authenticate header: ${JSON.stringify(response.headers.get('www-authenticate'))}
 - body: ${JSON.stringify(text)}`)
      return false
    }
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    debug(`The identity token is invalid: ${error}`)
    return false
  }
}

async function getInstrospectionEndpoint(): Promise<string> {
  const response = await shopifyFetch(`https://${await identityFqdn()}/.well-known/openid-configuration.json`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = await response.json()
  return json.introspection_endpoint
}
