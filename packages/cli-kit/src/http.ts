import {Service} from './network/service.js'
import {environmentForService} from './environment/service.js'
import https from 'https'

export {default as fetch} from './http/fetch.js'
export {graphqlClient} from './http/graphql.js'
export {shopifyFetch} from './http/fetch.js'
export {default as formData} from './http/formdata.js'

/**
 * This utility function returns the https.Agent to use for a given service. The agent
 * includes the right configuration based on the service's environment. For example,
 * if the service is running in a Spin environment, the attribute "rejectUnauthorized" is
 * set to false
 */
export async function httpsAgent(service: Service) {
  return new https.Agent({rejectUnauthorized: await shouldRejectUnauthorizedRequests(service)})
}

/**
 * Spin stores the CA certificate in the keychain and it should be used when sending HTTP
 * requests to Spin instances. However, Node doesn't read certificates from the Keychain
 * by default, which leads to Shopifolks running into issues that they workaround by setting the
 * NODE_TLS_REJECT_UNAUTHORIZED=0 environment variable, which applies to all the HTTP
 * requests sent from the CLI (context: https://github.com/nodejs/node/issues/39657)
 * This utility function allows controlling the behavior in a per-service level by returning
 * the value of for the "rejectUnauthorized" attribute that's used in the https agent.
 *
 * @returns {Promise<boolean>} A promise that resolves with a boolean indicating whether
 * unauthorized requests should be rejected or not.
 */
export async function shouldRejectUnauthorizedRequests(service: Service): Promise<boolean> {
  return (await environmentForService(service)) !== 'spin'
}
