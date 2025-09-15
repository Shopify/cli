/* eslint-disable @typescript-eslint/no-non-null-assertion */

import {BaseConfigType, MAX_EXTENSION_HANDLE_LENGTH, MAX_UID_LENGTH} from './schemas.js'
import {FunctionConfigType} from './specifications/function.js'
import {ExtensionFeature, ExtensionSpecification} from './specification.js'
import {SingleWebhookSubscriptionType} from './specifications/app_config_webhook_schemas/webhooks_schema.js'
import {AppHomeSpecIdentifier} from './specifications/app_config_app_home.js'
import {AppAccessSpecIdentifier} from './specifications/app_config_app_access.js'
import {AppProxySpecIdentifier} from './specifications/app_config_app_proxy.js'
import {BrandingSpecIdentifier} from './specifications/app_config_branding.js'
import {PosSpecIdentifier} from './specifications/app_config_point_of_sale.js'
import {PrivacyComplianceWebhooksSpecIdentifier} from './specifications/app_config_privacy_compliance_webhooks.js'
import {WebhooksSpecIdentifier} from './specifications/app_config_webhook.js'
import {WebhookSubscriptionSpecIdentifier} from './specifications/app_config_webhook_subscription.js'
import {
  ExtensionBuildOptions,
  buildFlowTemplateExtension,
  buildFunctionExtension,
  buildThemeExtension,
  buildUIExtension,
  bundleFunctionExtension,
} from '../../services/build/extension.js'
import {bundleThemeExtension} from '../../services/extensions/bundle.js'
import {Identifiers} from '../app/identifiers.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {AppConfigurationWithoutPath} from '../app/app.js'
import {ApplicationURLs} from '../../services/dev/urls.js'
import {ok} from '@shopify/cli-kit/node/result'
import {constantize, slugify} from '@shopify/cli-kit/common/string'
import {hashString, nonRandomUUID} from '@shopify/cli-kit/node/crypto'
import {partnersFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {joinPath, basename} from '@shopify/cli-kit/node/path'
import {fileExists, touchFile, moveFile, writeFile, glob, copyFile} from '@shopify/cli-kit/node/fs'
import {getPathValue} from '@shopify/cli-kit/common/object'
import {outputDebug} from '@shopify/cli-kit/node/output'

export const CONFIG_EXTENSION_IDS: string[] = [
  AppAccessSpecIdentifier,
  AppHomeSpecIdentifier,
  AppProxySpecIdentifier,
  BrandingSpecIdentifier,
  PosSpecIdentifier,
  PrivacyComplianceWebhooksSpecIdentifier,
  WebhookSubscriptionSpecIdentifier,
  WebhooksSpecIdentifier,
]

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
  uid: string

  get graphQLType() {
    return (this.specification.graphQLType ?? this.specification.identifier).toUpperCase()
  }

  get type(): string {
    return this.specification.identifier
  }

  get humanName() {
    return this.specification.externalName
  }

  get name(): string {
    return this.configuration.name ?? this.specification.externalName
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

  get isSourceMapGeneratingExtension() {
    return this.features.includes('generates_source_maps')
  }

  get isAppConfigExtension() {
    return ['single', 'dynamic'].includes(this.specification.uidStrategy)
  }

  get isFlow() {
    return this.specification.identifier.includes('flow')
  }

  get isEditorExtensionCollection() {
    return this.specification.identifier === 'editor_extension_collection'
  }

  get features(): ExtensionFeature[] {
    return this.specification.appModuleFeatures(this.configuration)
  }

  get outputFileName() {
    return this.isFunctionExtension ? 'index.wasm' : `${this.handle}.js`
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
    this.handle = this.buildHandle()
    this.localIdentifier = this.handle
    this.idEnvironmentVariableName = `SHOPIFY_${constantize(this.localIdentifier)}_ID`
    this.outputPath = this.directory
    this.uid = this.buildUIDFromStrategy()
    this.devUUID = `dev-${this.uid}`

    if (this.features.includes('esbuild') || this.type === 'tax_calculation') {
      this.outputPath = joinPath(this.directory, 'dist', this.outputFileName)
    }

    if (this.isFunctionExtension) {
      const config = this.configuration as unknown as FunctionConfigType
      this.outputPath = joinPath(this.directory, config.build.path ?? joinPath('dist', 'index.wasm'))
    }
  }

  get draftMessages() {
    if (this.isAppConfigExtension) return {successMessage: undefined, errorMessage: undefined}
    const successMessage = `Draft updated successfully for extension: ${this.localIdentifier}`
    const errorMessage = `Error updating extension draft for ${this.localIdentifier}`
    return {successMessage, errorMessage}
  }

  get isUUIDStrategyExtension() {
    return this.specification.uidStrategy === 'uuid'
  }

  get isSingleStrategyExtension() {
    return this.specification.uidStrategy === 'single'
  }

  get isDynamicStrategyExtension() {
    return this.specification.uidStrategy === 'dynamic'
  }

  get outputPrefix() {
    return this.handle
  }

  isSentToMetrics() {
    return !this.isAppConfigExtension
  }

  isReturnedAsInfo() {
    return !this.isAppConfigExtension
  }

  async deployConfig({
    apiKey,
    appConfiguration,
  }: ExtensionDeployConfigOptions): Promise<{[key: string]: unknown} | undefined> {
    const deployConfig = await this.specification.deployConfig?.(this.configuration, this.directory, apiKey, undefined)
    const transformedConfig = this.specification.transformLocalToRemote?.(this.configuration, appConfiguration) as
      | {[key: string]: unknown}
      | undefined
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

  async keepBuiltSourcemapsLocally(inputPath: string): Promise<void> {
    if (!this.isSourceMapGeneratingExtension) return Promise.resolve()

    const pathsToMove = await glob(`**/${this.handle}.js.map`, {
      cwd: inputPath,
      absolute: true,
      followSymbolicLinks: false,
    })

    const pathToMove = pathsToMove[0]
    if (pathToMove === undefined) return Promise.resolve()

    const outputPath = joinPath(this.directory, 'dist', basename(pathToMove))
    await moveFile(pathToMove, outputPath, {overwrite: true})
    outputDebug(`Source map for ${this.localIdentifier} created: ${outputPath}`)
  }

  async publishURL(options: {orgId: string; appId: string; extensionId?: string}) {
    const fqdn = await partnersFqdn()
    const parnersPath = this.specification.partnersWebIdentifier
    return `https://${fqdn}/${options.orgId}/apps/${options.appId}/extensions/${parnersPath}/${options.extensionId}`
  }

  getOutputFolderId(outputId?: string) {
    // Ideally we want to return `this.uid` always. To keep supporting Partners API we accept a value to override that.

    return outputId ?? this.uid
  }

  // UI Specific properties
  getBundleExtensionStdinContent() {
    if (this.specification.getBundleExtensionStdinContent) {
      return this.specification.getBundleExtensionStdinContent(this.configuration)
    }
    const relativeImportPath = this.entrySourceFilePath.replace(this.directory, '')
    return {main: `import '.${relativeImportPath}';`}
  }

  shouldFetchCartUrl(): boolean {
    return this.features.includes('cart_url')
  }

  hasExtensionPointTarget(target: string): boolean {
    return this.specification.hasExtensionPointTarget?.(this.configuration, target) ?? false
  }

  // Functions specific properties
  get buildCommand() {
    const config = this.configuration as unknown as FunctionConfigType
    return config.build.command
  }

  // Paths to be watched in a dev session
  // Return undefiend if there aren't custom configured paths. (everything is watched)
  // If there are, include some default paths.
  get devSessionWatchPaths() {
    const config = this.configuration as unknown as FunctionConfigType
    if (!config.build || !config.build.watch) return undefined

    const watchPaths = [config.build.watch].flat().map((path) => joinPath(this.directory, path))

    watchPaths.push(joinPath(this.directory, 'locales', '**.json'))
    watchPaths.push(joinPath(this.directory, '**', '!(.)*.graphql'))
    watchPaths.push(joinPath(this.directory, '**.toml'))

    return watchPaths
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
    } else if (this.isThemeExtension) {
      return [joinPath(this.directory, '*', '*')]
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
    return Boolean(this.entrySourceFilePath.endsWith('.js') || this.entrySourceFilePath.endsWith('.ts'))
  }

  async build(options: ExtensionBuildOptions): Promise<void> {
    const mode = this.specification.buildConfig.mode

    switch (mode) {
      case 'theme':
        return buildThemeExtension(this, options)
      case 'function':
        return buildFunctionExtension(this, options)
      case 'ui':
        return buildUIExtension(this, options)
      case 'flow':
        return buildFlowTemplateExtension(this, options)
      case 'tax_calculation':
        await touchFile(this.outputPath)
        await writeFile(this.outputPath, '(()=>{})();')
        break
      case 'none':
        break
    }
  }

  async buildForBundle(options: ExtensionBuildOptions, bundleDirectory: string, outputId?: string) {
    this.outputPath = this.getOutputPathForDirectory(bundleDirectory, outputId)

    await this.build(options)
    if (this.isThemeExtension) {
      await bundleThemeExtension(this, options)
    }

    const bundleInputPath = joinPath(bundleDirectory, this.getOutputFolderId(outputId))
    await this.keepBuiltSourcemapsLocally(bundleInputPath)
  }

  async copyIntoBundle(options: ExtensionBuildOptions, bundleDirectory: string, extensionUuid?: string) {
    const defaultOutputPath = this.outputPath

    this.outputPath = this.getOutputPathForDirectory(bundleDirectory, extensionUuid)

    const buildMode = this.specification.buildConfig.mode

    if (this.isThemeExtension) {
      await bundleThemeExtension(this, options)
    } else if (buildMode !== 'none') {
      outputDebug(`Will copy pre-built file from ${defaultOutputPath} to ${this.outputPath}`)
      if (await fileExists(defaultOutputPath)) {
        await copyFile(defaultOutputPath, this.outputPath)

        if (buildMode === 'function') {
          await bundleFunctionExtension(this.outputPath, this.outputPath)
        }
      }
    }
  }

  getOutputPathForDirectory(directory: string, outputId?: string) {
    const id = this.getOutputFolderId(outputId)
    const outputFile = this.isThemeExtension ? '' : joinPath('dist', this.outputFileName)
    return joinPath(directory, id, outputFile)
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

  async bundleConfig({
    identifiers,
    developerPlatformClient,
    apiKey,
    appConfiguration,
  }: ExtensionBundleConfigOptions): Promise<BundleConfig | undefined> {
    const configValue = await this.deployConfig({apiKey, appConfiguration})
    if (!configValue) return undefined

    const result = {
      config: JSON.stringify(configValue),
      context: this.contextValue,
      handle: this.handle,
    }

    const uuid = this.isUUIDStrategyExtension
      ? identifiers.extensions[this.localIdentifier]!
      : identifiers.extensionsNonUuidManaged[this.localIdentifier]!

    return {
      ...result,
      uid: this.uid,
      uuid,
      specificationIdentifier: developerPlatformClient.toExtensionGraphQLType(this.graphQLType),
    }
  }

  async getDevSessionUpdateMessages(): Promise<string[] | undefined> {
    if (!this.specification.getDevSessionUpdateMessages) return undefined
    return this.specification.getDevSessionUpdateMessages(this.configuration)
  }

  /**
   * Patches the configuration with the app dev URLs if applicable
   * Only for modules that use the app URL in their configuration.
   * @param urls - The app dev URLs
   */
  patchWithAppDevURLs(urls: ApplicationURLs) {
    if (!this.specification.patchWithAppDevURLs) return
    this.specification.patchWithAppDevURLs(this.configuration, urls)
  }

  async contributeToSharedTypeFile(typeDefinitionsByFile: Map<string, Set<string>>) {
    await this.specification.contributeToSharedTypeFile?.(this, typeDefinitionsByFile)
  }

  private buildHandle() {
    switch (this.specification.uidStrategy) {
      case 'single':
        return this.specification.identifier
      case 'uuid':
        return this.configuration.handle ?? slugify(this.name ?? '')
      case 'dynamic':
        // Hardcoded temporal solution for webhooks
        if ('topic' in this.configuration && 'uri' in this.configuration) {
          const subscription = this.configuration as unknown as SingleWebhookSubscriptionType
          const handle = `${subscription.topic}${subscription.uri}${subscription.filter}`
          return hashString(handle).substring(0, MAX_EXTENSION_HANDLE_LENGTH)
        } else {
          return nonRandomUUID(JSON.stringify(this.configuration))
        }
    }
  }

  private buildUIDFromStrategy() {
    switch (this.specification.uidStrategy) {
      case 'single':
        return this.specification.identifier
      case 'uuid':
        return this.configuration.uid ?? nonRandomUUID(this.handle)
      case 'dynamic':
        // NOTE: This is a temporary special case for webhook subscriptions.
        // We're directly checking for webhook properties and casting the configuration
        // instead of using a proper dynamic strategy implementation.
        // To remove this special case:
        // 1. Implement a proper dynamic UID strategy for webhooks in the server-side specification
        // 2. Update the CLI to use that strategy instead of this hardcoded logic
        // Related issues: PR #559094 in old Core repo
        if ('topic' in this.configuration && 'uri' in this.configuration) {
          const subscription = this.configuration as unknown as SingleWebhookSubscriptionType
          return `${subscription.topic}::${subscription.filter}::${subscription.uri}`.substring(0, MAX_UID_LENGTH)
        } else {
          return nonRandomUUID(JSON.stringify(this.configuration))
        }
    }
  }
}

interface ExtensionDeployConfigOptions {
  apiKey: string
  appConfiguration: AppConfigurationWithoutPath
}

interface ExtensionBundleConfigOptions {
  identifiers: Identifiers
  developerPlatformClient: DeveloperPlatformClient
  apiKey: string
  appConfiguration: AppConfigurationWithoutPath
}

interface BundleConfig {
  config: string
  context: string
  handle: string
  uid: string
  uuid: string
  specificationIdentifier: string
}
