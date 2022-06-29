import {identity} from '../environment/fqdn'
import {debug} from '../output'

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

    const response = await fetch(instrospectionURL, options)
    const json = await response.json()

    debug(`The identity token is valid: ${json.valid}`)
    return json.valid
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    debug(`The identity token is invalid: ${error}`)
    return false
  }
}

async function getInstrospectionEndpoint(): Promise<string> {
  const response = await fetch(`https://${await identity()}/.well-known/openid-configuration.json`)
  const json = await response.json()
  return json.introspection_endpoint
}
