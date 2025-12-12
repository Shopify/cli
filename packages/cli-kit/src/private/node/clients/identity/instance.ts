import {IdentityClient} from './identity-client.js'
import {IdentityMockClient} from './identity-mock-client.js'
import {IdentityServiceClient} from './identity-service-client.js'
import {Environment, serviceEnvironment} from '../../context/service.js'
import {isRunning2024} from '../../../../public/node/vendor/dev_server/dev-server-2024.js'

let _identityClient: IdentityClient | undefined

export function getIdentityClient() {
  if (!_identityClient) {
    const isLocal = serviceEnvironment() === Environment.Local
    const identityServiceRunning = isRunning2024('identity')
    const client = isLocal && !identityServiceRunning ? new IdentityMockClient() : new IdentityServiceClient()
    _identityClient = client
  }

  return _identityClient
}
