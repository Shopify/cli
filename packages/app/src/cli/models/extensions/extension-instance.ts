import {BaseConfigType} from './schemas.js'
import {FunctionConfigType} from './specifications/function.js'
import {ExtensionFeature, ExtensionSpecification} from './specification.js'
import {
  ExtensionBuildOptions,
  buildFunctionExtension,
  buildThemeExtension,
  buildUIExtension,
} from '../../services/build/extension.js'
import {bundleThemeExtension} from '../../services/extensions/bundle.js'
import {Identifiers} from '../app/identifiers.js'
import {uploadWasmBlob} from '../../services/deploy/upload.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {ok} from '@shopify/cli-kit/node/result'
import {constantize, slugify} from '@shopify/cli-kit/common/string'
import {randomUUID} from '@shopify/cli-kit/node/crypto'
import {partnersFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {joinPath} from '@shopify/cli-kit/node/path'
import {useThemebundling} from '@shopify/cli-kit/node/context/local'
import {fileExists, touchFile, writeFile} from '@shopify/cli-kit/node/fs'
import {getPathValue} from '@shopify/cli-kit/common/object'

/**
 * Class that represents an instance of a local extension
 * Before creating this class we've validated that:
 * - There is a spec for this type of extension
 * - The Schema for that spec is followed by the extension config toml file
 * - We were able to find an entry point file for that extension
 *
 * It supports extension points, making this Class compatible with both new ui-extension
 * and legacy extension types. Extension points are optional and this class will handle them if present.
 *
 * This class holds the public interface to interact with extensions
 */
export class ExtensionInstance<TConfiguration extends BaseConfigType = BaseConfigType> {
  entrySourceFilePath: string
  devUUID: string
  localIdentifier: string
  idEnvironmentVariableName: string
  directory: string
  configuration: TConfiguration
  configurationPath: string
  outputPath: string
  handle: string
  specification: ExtensionSpecification

  get graphQLType() {
    return (this.specification.graphQLType ?? this.specification.identifier).toUpperCase()
  }

  get type() {
    return this.configuration.type
  }

  get humanName() {
    return this.specification.externalName
  }

  get name() {
    return this.configuration.name
  }

  get dependency() {
    return this.specification.dependency
  }

  get externalType() {
    return this.specification.externalIdentifier
  }

  get surface() {
    return this.specification.surface
  }

  get isPreviewable() {
    return this.features.includes('ui_preview')
  }

  get isThemeExtension() {
    return this.features.includes('theme')
  }

  get isFunctionExtension() {
    return this.features.includes('function')
  }

  get isESBuildExtension() {
    return this.features.includes('esbuild')
  }

  get isAppConfigExtension() {
    return this.specification.experience === 'configuration'
  }

  get isFlow() {
    return this.specification.identifier.includes('flow')
  }

  get features(): ExtensionFeature[] {
    return this.specification.appModuleFeatures(this.configuration)
  }

  get outputFileName() {
    return `${this.handle}.js`
  }

  constructor(options: {
    configuration: TConfiguration
    configurationPath: string
    entryPath?: string
    directory: string
    specification: ExtensionSpecification
  }) {
    this.configuration = options.configuration
    this.configurationPath = options.configurationPath
    this.entrySourceFilePath = options.entryPath ?? ''
    this.directory = options.directory
    this.specification = options.specification
    this.devUUID = `dev-${randomUUID()}`
    this.handle =
      this.specification.experience === 'configuration'
        ? slugify(this.specification.identifier)
        : this.configuration.handle ?? slugify(this.configuration.name ?? '')
    this.localIdentifier = this.handle
    this.idEnvironmentVariableName = `SHOPIFY_${constantize(this.localIdentifier)}_ID`
    this.outputPath = this.directory

    if (this.features.includes('esbuild') || this.type === 'tax_calculation') {
      this.outputPath = joinPath(this.directory, 'dist', `${this.outputFileName}`)
    }

    if (this.isFunctionExtension) {
      const config = this.configuration as unknown as FunctionConfigType
      this.outputPath = joinPath(this.directory, config.build.path ?? joinPath('dist', 'index.wasm'))
    }
  }

  isDraftable() {
    return !this.isThemeExtension
  }

  get draftMessages() {
    const successMessage =
      this.isDraftable() && !this.isAppConfigExtension
        ? `Draft updated successfully for extension: ${this.localIdentifier}`
        : undefined
    const errorMessage =
      this.isDraftable() && !this.isAppConfigExtension ? `Error while deploying updated extension draft` : undefined
    return {successMessage, errorMessage}
  }

  isUuidManaged() {
    return !this.isAppConfigExtension
  }

  isSentToMetrics() {
    return !this.isAppConfigExtension
  }

  isReturnedAsInfo() {
    return !this.isAppConfigExtension
  }

  async deployConfig({
    apiKey,
    developerPlatformClient,
  }: ExtensionDeployConfigOptions): Promise<{[key: string]: unknown} | undefined> {
    if (this.isFunctionExtension) return this.functionDeployConfig({apiKey, developerPlatformClient})
    return this.commonDeployConfig(apiKey)
  }

  async functionDeployConfig({
    apiKey,
    developerPlatformClient,
  }: ExtensionDeployConfigOptions): Promise<{[key: string]: unknown} | undefined> {
    const {moduleId} = await uploadWasmBlob(this.localIdentifier, this.outputPath, developerPlatformClient)
    return this.specification.deployConfig?.(this.configuration, this.directory, apiKey, moduleId)
  }

  async commonDeployConfig(apiKey: string): Promise<{[key: string]: unknown} | undefined> {
    const deployConfig = await this.specification.deployConfig?.(this.configuration, this.directory, apiKey, undefined)
    const transformedConfig = this.specification.transform?.(this.configuration) as {[key: string]: unknown} | undefined
    const resultDeployConfig = deployConfig ?? transformedConfig ?? undefined
    return resultDeployConfig && Object.keys(resultDeployConfig).length > 0 ? resultDeployConfig : undefined
  }

  validate() {
    if (!this.specification.validate) return Promise.resolve(ok(undefined))
    return this.specification.validate(this.configuration, this.configurationPath, this.directory)
  }

  preDeployValidation(): Promise<void> {
    if (!this.specification.preDeployValidation) return Promise.resolve()
    return this.specification.preDeployValidation(this)
  }

  buildValidation(): Promise<void> {
    if (!this.specification.buildValidation) return Promise.resolve()
    return this.specification.buildValidation(this)
  }

  async publishURL(options: {orgId: string; appId: string; extensionId?: string}) {
    const fqdn = await partnersFqdn()
    const parnersPath = this.specification.partnersWebIdentifier
    return `https://${fqdn}/${options.orgId}/apps/${options.appId}/extensions/${parnersPath}/${options.extensionId}`
  }

  // UI Specific properties
  getBundleExtensionStdinContent() {
    if (this.specification.getBundleExtensionStdinContent) {
      return this.specification.getBundleExtensionStdinContent(this.configuration)
    }
    const relativeImportPath = this.entrySourceFilePath?.replace(this.directory, '')
    return `import '.${relativeImportPath}';`
  }

  shouldFetchCartUrl(): boolean {
    return this.features.includes('cart_url')
  }

  hasExtensionPointTarget(target: string): boolean {
    return this.specification.hasExtensionPointTarget?.(this.configuration, target) || false
  }

  // Functions specific properties
  get buildCommand() {
    const config = this.configuration as unknown as FunctionConfigType
    return config.build.command
  }

  get watchBuildPaths() {
    if (this.isFunctionExtension) {
      const config = this.configuration as unknown as FunctionConfigType
      const configuredPaths = config.build.watch ? [config.build.watch].flat() : []

      if (!this.isJavaScript && configuredPaths.length === 0) {
        return null
      }

      const watchPaths: string[] = configuredPaths ?? []
      if (this.isJavaScript && configuredPaths.length === 0) {
        watchPaths.push(joinPath('src', '**', '*.{js,ts}'))
      }
      watchPaths.push(joinPath('**', '!(.)*.graphql'))

      return watchPaths.map((path) => joinPath(this.directory, path))
    } else if (this.isESBuildExtension) {
      return [joinPath(this.directory, 'src', '**', '*.{ts,tsx,js,jsx}')]
    } else {
      return []
    }
  }

  async watchConfigurationPaths() {
    if (this.isAppConfigExtension) {
      return [this.configurationPath]
    } else {
      const additionalPaths = []
      if (await fileExists(joinPath(this.directory, 'locales'))) {
        additionalPaths.push(joinPath(this.directory, 'locales', '**.json'))
      }
      additionalPaths.push(joinPath(this.directory, '**.toml'))
      return additionalPaths
    }
  }

  get inputQueryPath() {
    return joinPath(this.directory, 'input.graphql')
  }

  get isJavaScript() {
    return Boolean(this.entrySourceFilePath?.endsWith('.js') || this.entrySourceFilePath?.endsWith('.ts'))
  }

  async build(options: ExtensionBuildOptions): Promise<void> {
    if (this.isThemeExtension) {
      return buildThemeExtension(this, options)
    } else if (this.isFunctionExtension) {
      return buildFunctionExtension(this, options)
    } else if (this.features.includes('esbuild')) {
      return buildUIExtension(this, options)
    }

    // Workaround for tax_calculations because they remote spec NEEDS a valid js file to be included.
    if (this.type === 'tax_calculation') {
      await touchFile(this.outputPath)
      await writeFile(this.outputPath, '(()=>{})();')
    }
  }

  async buildForBundle(options: ExtensionBuildOptions, identifiers: Identifiers, bundleDirectory: string) {
    const extensionId = identifiers.extensions[this.localIdentifier]!
    const outputFile = this.isThemeExtension ? '' : joinPath('dist', `${this.outputFileName}`)

    if (this.features.includes('bundling')) {
      // Modules that are going to be inclued in the bundle should be built in the bundle directory
      this.outputPath = joinPath(bundleDirectory, extensionId, outputFile)
    }

    await this.build(options)

    if (this.isThemeExtension && useThemebundling()) {
      await bundleThemeExtension(this, options)
    }
  }

  get singleTarget() {
    const targets = (getPathValue(this.configuration, 'targeting') as {target: string}[]) ?? []
    if (targets.length !== 1) return undefined
    return targets[0]?.target
  }

  get contextValue() {
    let context = this.singleTarget ?? ''
    if (this.isFlow) context = this.configuration.handle ?? ''
    return context
  }

  async bundleConfig({identifiers, developerPlatformClient, apiKey}: ExtensionBundleConfigOptions) {
    const configValue = await this.deployConfig({apiKey, developerPlatformClient})
    if (!configValue) return undefined

    const result = {
      config: JSON.stringify(configValue),
      context: this.contextValue,
      handle: this.handle,
    }

    const uuid = this.isUuidManaged()
      ? identifiers.extensions[this.localIdentifier]
      : identifiers.extensionsNonUuidManaged[this.localIdentifier]
    return {...result, uuid}
  }
}

export interface ExtensionDeployConfigOptions {
  apiKey: string
  developerPlatformClient: DeveloperPlatformClient
}

export interface ExtensionBundleConfigOptions {
  identifiers: Identifiers
  developerPlatformClient: DeveloperPlatformClient
  apiKey: string
}
