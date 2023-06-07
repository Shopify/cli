import {ExtensionFlavorValue} from '../../services/generate/extension.js'
import {ExtensionFeature} from '../extensions/specification.js'
import {FunctionConfigType} from '../extensions/specifications/function.js'

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

export type FunctionExtension = Extension & {
  configuration: FunctionConfigType
  entrySourceFilePath?: string
  buildCommand: string | undefined
  outputPath: string
  inputQueryPath: string
  isJavaScript: boolean
  usingExtensionsFramework: boolean
}
