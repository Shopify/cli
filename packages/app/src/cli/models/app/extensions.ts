import {FunctionSpec, FunctionConfigType} from '../extensions/functions.js'
import {ThemeConfigContents, ThemeExtensionSpec} from '../extensions/theme.js'
import {UIExtensionSpec} from '../extensions/ui.js'
import {BaseConfigContents} from '../extensions/schemas.js'
import {output} from '@shopify/cli-kit'
import {Result} from '@shopify/cli-kit/node/result'
import {DependencyVersion} from '@shopify/cli-kit/node/node-package-manager'

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
  supportedFlavors: {name: string; value: string}[]
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
  buildWasmPath: () => string
  inputQueryPath: () => string
}

export type ThemeExtension<TConfiguration extends ThemeConfigContents = ThemeConfigContents> = Extension & {
  configuration: TConfiguration
  previewMessage(url: string, storeFqdn: string): output.TokenizedString | undefined
}

export type UIExtension<TConfiguration extends BaseConfigContents = BaseConfigContents> = Extension & {
  configuration: TConfiguration
  entrySourceFilePath?: string
  outputBundlePath: string
  devUUID: string
  surface: string | null
  dependency?: DependencyVersion
  getBundleExtensionStdinContent(): string
  validate(): Promise<Result<unknown, string>>
  preDeployValidation(): Promise<void>
  deployConfig(): Promise<{[key: string]: unknown}>
  previewMessage(url: string, storeFqdn: string): output.TokenizedString | undefined
  shouldFetchCartUrl(): boolean
  hasExtensionPointTarget(target: string): boolean
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
