import {identity} from '../environment/fqdn.js'
import {debug} from '../output.js'
import {shopifyFetch} from '../http.js'

export async function validateIdentityToken(token: string) {
  try {
    const instrospectionURL = await getInstrospectionEndpoint()
    const options = {
      method: 'POST',
      // eslint-disable-next-line @typescript-eslint/naming-convention
      headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
      body: JSON.stringify({token}),
    }
    debug(`Sending Identity Introspection request to URL: ${instrospectionURL}`)

    const response = await shopifyFetch('shopify', instrospectionURL, options)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await response.json()

    debug(`The identity token is valid: ${json.valid}`)
    return json.valid
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    debug(`The identity token is invalid: ${error}`)
    return false
  }
}

async function getInstrospectionEndpoint(): Promise<string> {
  const response = await shopifyFetch('identity', `https://${await identity()}/.well-known/openid-configuration.json`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = await response.json()
  return json.introspection_endpoint
}
