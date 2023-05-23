import {FunctionSpec, FunctionConfigType} from '../extensions/functions.js'
import {ThemeConfigContents, ThemeExtensionSpec} from '../extensions/theme.js'
import {UIExtensionSpec} from '../extensions/ui.js'
import {BaseConfigContents} from '../extensions/schemas.js'
import {ExtensionFlavorValue} from '../../services/generate/extension.js'
import {TokenizedString} from '@shopify/cli-kit/node/output'
import {Result} from '@shopify/cli-kit/node/result'

export type ExtensionCategory = 'ui' | 'function' | 'theme'

/**
 * Common interface for ExtensionSpec and FunctionSpec
 */
export interface GenericSpecification {
  identifier: string
  externalIdentifier: string
  externalName: string
  registrationLimit: number
  helpURL?: string
  supportedFlavors: ExtensionFlavor[]
  gated: boolean
  category: () => ExtensionCategory
  group?: string
}

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
}

export type FunctionExtension<TConfiguration extends FunctionConfigType = FunctionConfigType> = Extension & {
  configuration: TConfiguration
  entrySourceFilePath?: string
  buildCommand: string | undefined
  buildWasmPath: string
  inputQueryPath: string
  isJavaScript: boolean
  usingExtensionsFramework: boolean
}

export type ThemeExtension<TConfiguration extends ThemeConfigContents = ThemeConfigContents> = Extension & {
  configuration: TConfiguration
  previewMessage(url: string, storeFqdn: string): TokenizedString | undefined
  outputBundlePath: string
}

export type UIExtension<TConfiguration extends BaseConfigContents = BaseConfigContents> = Extension & {
  configuration: TConfiguration
  entrySourceFilePath?: string
  outputBundlePath: string
  devUUID: string
  surface: string
  dependency?: string
  getBundleExtensionStdinContent(): string
  validate(): Promise<Result<unknown, string>>
  preDeployValidation(): Promise<void>
  buildValidation(): Promise<void>
  deployConfig(): Promise<{[key: string]: unknown}>
  previewMessage(url: string, storeFqdn: string): TokenizedString | undefined
  shouldFetchCartUrl(): boolean
  hasExtensionPointTarget(target: string): boolean
  isPreviewable: boolean
}

export function isUIExtension(spec: GenericSpecification): spec is UIExtensionSpec {
  return spec.category() === 'ui'
}

export function isThemeExtension(spec: GenericSpecification): spec is ThemeExtensionSpec {
  return spec.category() === 'theme'
}

export function isFunctionExtension(spec: GenericSpecification): spec is FunctionSpec {
  return spec.category() === 'function'
}
