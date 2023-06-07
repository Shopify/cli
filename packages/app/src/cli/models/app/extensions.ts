import {ExtensionFlavorValue} from '../../services/generate/extension.js'
import {ExtensionFeature} from '../extensions/specification.js'

export type ExtensionCategory = 'ui' | 'function' | 'theme'

export interface ExtensionFlavor {
  name: string
  value: ExtensionFlavorValue
  path?: string
}

export interface Extension {
  idEnvironmentVariableName: string
  localIdentifier: string
  configurationPath: string
  directory: string
  type: string
  externalType: string
  graphQLType: string
  publishURL(options: {orgId: string; appId: string; extensionId?: string}): Promise<string>
  features: ExtensionFeature[]
}
