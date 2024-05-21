import {AppInterface, CurrentAppConfiguration} from './app.js'
import {RemoteAwareExtensionSpecification} from '../extensions/specification.js'

interface LoadLinkedAppOptions {}

interface LoadLinkedAppResult {
  app: AppInterface<CurrentAppConfiguration, RemoteAwareExtensionSpecification>
}

export async function loadLinkedApp(_options: LoadLinkedAppOptions): Promise<LoadLinkedAppResult> {
  throw new Error('Not implemented')
}
