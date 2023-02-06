import {identityFqdn} from '../../../public/node/context/fqdn.js'
import {outputDebug} from '../../../public/node/output.js'
import {shopifyFetch} from '../../../public/node/http.js'

export async function validateIdentityToken(token: string) {
  try {
    const instrospectionURL = await getInstrospectionEndpoint()
    const options = {
      method: 'POST',
      headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
      body: JSON.stringify({token}),
    }
    outputDebug(`Sending Identity Introspection request to URL: ${instrospectionURL}`)

    const response = await shopifyFetch(instrospectionURL, options)

    if (response.ok && response.headers.get('content-type')?.includes('json')) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await response.json()
      outputDebug(`The identity token is valid: ${json.valid}`)
      return json.valid
    } else {
      const text = await response.text()
      outputDebug(`The Introspection request failed with:
 - status: ${response.status}
 - www-authenticate header: ${JSON.stringify(response.headers.get('www-authenticate'))}
 - body: ${JSON.stringify(text)}`)
      return false
    }
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    outputDebug(`The identity token is invalid: ${error}`)
    return false
  }
}

async function getInstrospectionEndpoint(): Promise<string> {
  const response = await shopifyFetch(`https://${await identityFqdn()}/.well-known/openid-configuration.json`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = await response.json()
  return json.introspection_endpoint
}
