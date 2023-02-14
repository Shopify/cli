import {FunctionSpec, FunctionConfigType} from '../extensions/functions.js'
import {ThemeConfigContents, ThemeExtensionSpec} from '../extensions/theme.js'
import {ConfigurationExtensionConfigType, ConfigurationExtensionSpec} from '../extensions/configurations.js'
import {UIExtensionSpec} from '../extensions/ui.js'
import {BaseConfigContents} from '../extensions/schemas.js'
import {ExtensionFlavor} from '../../services/generate/extension.js'
import {TokenizedString} from '@shopify/cli-kit/node/output'
import {Result} from '@shopify/cli-kit/node/result'
import {DependencyVersion} from '@shopify/cli-kit/node/node-package-manager'

export type ExtensionCategory = 'ui' | 'function' | 'theme' | 'configuration'

/**
 * Common interface for ExtensionSpec and FunctionSpec
 */
export interface GenericSpecification {
  identifier: string
  externalIdentifier: string
  externalName: string
  registrationLimit: number
  helpURL?: string
  supportedFlavors: {name: string; value: ExtensionFlavor}[]
  gated: boolean
  category: () => ExtensionCategory
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
  dependency?: DependencyVersion
  getBundleExtensionStdinContent(): string
  validate(): Promise<Result<unknown, string>>
  preDeployValidation(): Promise<void>
  deployConfig(): Promise<{[key: string]: unknown}>
  previewMessage(url: string, storeFqdn: string): TokenizedString | undefined
  shouldFetchCartUrl(): boolean
  hasExtensionPointTarget(target: string): boolean
}

export type ConfigurationExtension<
  TConfiguration extends ConfigurationExtensionConfigType = ConfigurationExtensionConfigType,
> = Extension & {
  configuration: TConfiguration
  deployConfig(): Promise<{[key: string]: unknown}>
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

export function isConfigurationExtension(spec: GenericSpecification): spec is ConfigurationExtensionSpec {
  return spec.category() === 'configuration'
}
