/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable no-case-declarations */
import {BaseConfigType, MAX_EXTENSION_HANDLE_LENGTH} from './schemas.js'
import {FunctionConfigType} from './specifications/function.js'
import {ExtensionFeature, ExtensionSpecification} from './specification.js'
import {SingleWebhookSubscriptionType} from './specifications/app_config_webhook_schemas/webhooks_schema.js'
import {AppHomeSpecIdentifier} from './specifications/app_config_app_home.js'
import {AppAccessSpecIdentifier} from './specifications/app_config_app_access.js'
import {AppProxySpecIdentifier} from './specifications/app_config_app_proxy.js'
import {BrandingSpecIdentifier} from './specifications/app_config_branding.js'
import {PosSpecIdentifier} from './specifications/app_config_point_of_sale.js'
import appPrivacyComplienceSpec from './specifications/app_config_privacy_compliance_webhooks.js'
import {WebhooksSpecIdentifier} from './specifications/app_config_webhook.js'
import {WebhookSubscriptionSpecIdentifier} from './specifications/app_config_webhook_subscription.js'
import {
  ExtensionBuildOptions,
  buildFlowTemplateExtension,
  buildFunctionExtension,
  buildThemeExtension,
  buildUIExtension,
} from '../../services/build/extension.js'
import {bundleThemeExtension} from '../../services/extensions/bundle.js'
import {Identifiers} from '../app/identifiers.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {AppConfigurationWithoutPath} from '../app/app.js'
import {ok} from '@shopify/cli-kit/node/result'
import {constantize, slugify} from '@shopify/cli-kit/common/string'
import {hashString, randomUUID} from '@shopify/cli-kit/node/crypto'
import {partnersFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {joinPath} from '@shopify/cli-kit/node/path'
import {fileExists, touchFile, writeFile} from '@shopify/cli-kit/node/fs'
import {getPathValue} from '@shopify/cli-kit/common/object'
import {useThemebundling} from '@shopify/cli-kit/node/context/local'

export const CONFIG_EXTENSION_IDS = [
  AppAccessSpecIdentifier,
  AppHomeSpecIdentifier,
  AppProxySpecIdentifier,
  BrandingSpecIdentifier,
  PosSpecIdentifier,
  appPrivacyComplienceSpec,
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
    this.devUUID = `dev-${randomUUID()}`
    this.handle = this.buildHandle()
    this.localIdentifier = this.handle
    this.idEnvironmentVariableName = `SHOPIFY_${constantize(this.localIdentifier)}_ID`
    this.outputPath = this.directory
    this.uid = this.configuration.uid ?? randomUUID()

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
    const errorMessage = `Error while deploying updated extension draft`
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
    return Boolean(this.entrySourceFilePath?.endsWith('.js') || this.entrySourceFilePath?.endsWith('.ts'))
  }

  async build(options: ExtensionBuildOptions): Promise<void> {
    if (this.isThemeExtension) {
      return buildThemeExtension(this, options)
    } else if (this.isFunctionExtension) {
      return buildFunctionExtension(this, options)
    } else if (this.features.includes('esbuild')) {
      return buildUIExtension(this, options)
    } else if (this.specification.identifier === 'flow_template' && options.environment === 'production') {
      return buildFlowTemplateExtension(this, options)
    }

    // Workaround for tax_calculations because they remote spec NEEDS a valid js file to be included.
    if (this.type === 'tax_calculation') {
      await touchFile(this.outputPath)
      await writeFile(this.outputPath, '(()=>{})();')
    }
  }

  async buildForBundle(options: ExtensionBuildOptions, bundleDirectory: string, identifiers?: Identifiers) {
    const extensionId = identifiers?.extensions[this.localIdentifier] ?? this.configuration.uid ?? this.handle
    const outputFile = this.isThemeExtension ? '' : joinPath('dist', this.outputFileName)

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
    const uid = this.isUUIDStrategyExtension ? this.uid : uuid

    return {
      ...result,
      uid,
      uuid,
      specificationIdentifier: developerPlatformClient.toExtensionGraphQLType(this.graphQLType),
    }
  }

  private buildHandle() {
    switch (this.specification.uidStrategy) {
      case 'single':
        return slugify(this.specification.identifier)
      case 'uuid':
        return this.configuration.handle ?? slugify(this.configuration.name ?? '')
      case 'dynamic':
        // Hardcoded temporal solution for webhooks
        const subscription = this.configuration as unknown as SingleWebhookSubscriptionType
        const handle = `${subscription.topic}${subscription.uri}${subscription.filter}`
        return hashString(handle).substring(0, MAX_EXTENSION_HANDLE_LENGTH)
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
