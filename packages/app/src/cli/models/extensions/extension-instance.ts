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
import {ok} from '@shopify/cli-kit/node/result'
import {constantize} from '@shopify/cli-kit/common/string'
import {randomUUID} from '@shopify/cli-kit/node/crypto'
import {partnersFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {basename, joinPath} from '@shopify/cli-kit/node/path'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'
import {useThemebundling} from '@shopify/cli-kit/node/context/local'
import {touchFile, writeFile} from '@shopify/cli-kit/node/fs'

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

  private useExtensionsFramework: boolean

  get graphQLType() {
    if (this.features.includes('function')) {
      if (this.useExtensionsFramework) return 'FUNCTION'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const functionConfig: any = this.configuration
      return functionConfig.type.toUpperCase()
    }
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

  get features(): ExtensionFeature[] {
    return this.specification.appModuleFeatures(this.configuration)
  }

  set usingExtensionsFramework(value: boolean) {
    this.useExtensionsFramework = value
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
    this.handle = this.configuration.handle ?? basename(this.directory)
    this.localIdentifier = this.handle
    this.idEnvironmentVariableName = `SHOPIFY_${constantize(this.localIdentifier)}_ID`
    this.useExtensionsFramework = false
    this.outputPath = this.directory

    if (this.features.includes('esbuild')) {
      this.outputPath = joinPath(this.directory, 'dist/main.js')
    }

    if (this.isFunctionExtension) {
      const config = this.configuration as unknown as FunctionConfigType
      this.outputPath = joinPath(this.directory, config.build.path ?? joinPath('dist', 'index.wasm'))
    }
  }

  isDraftable(unifiedDeployment: boolean) {
    return !this.isPreviewable && !this.isThemeExtension && (unifiedDeployment || !this.isFunctionExtension)
  }

  async deployConfig({
    apiKey,
    token,
    unifiedDeployment,
  }: ExtensionDeployConfigOptions): Promise<{[key: string]: unknown} | undefined> {
    if (this.isFunctionExtension) {
      if (!unifiedDeployment) return undefined
      const {moduleId} = await uploadWasmBlob(this.localIdentifier, this.outputPath, apiKey, token)
      return this.specification.deployConfig?.(this.configuration, this.directory, apiKey, moduleId)
    }

    return (
      // module id param is not necessary for non-Function extensions
      this.specification.deployConfig?.(this.configuration, this.directory, apiKey, undefined) ??
      Promise.resolve(undefined)
    )
  }

  validate() {
    if (!this.specification.validate) return Promise.resolve(ok(undefined))
    return this.specification.validate(this.configuration, this.directory)
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

  previewMessage(url: string, storeFqdn: string) {
    const heading = outputToken.heading(`${this.name} (${this.humanName})`)
    let message = outputContent`Preview link: ${url}/extensions/${this.devUUID}`

    if (this.specification.previewMessage) {
      const customMessage = this.specification.previewMessage(url, this.devUUID, this.configuration, storeFqdn)
      if (!customMessage) return
      message = customMessage
    }

    return outputContent`${heading}\n${message.value}\n`
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
    return this.specification.shouldFetchCartUrl?.(this.configuration) || false
  }

  hasExtensionPointTarget(target: string): boolean {
    return this.specification.hasExtensionPointTarget?.(this.configuration, target) || false
  }

  // Functions specific properties
  get buildCommand() {
    const config = this.configuration as unknown as FunctionConfigType
    return config.build.command
  }

  get watchPaths() {
    const config = this.configuration as unknown as FunctionConfigType
    const configuredPaths = config.build.watch ? [config.build.watch].flat() : []

    if (!this.isJavaScript && configuredPaths.length === 0) {
      return null
    }

    const watchPaths: string[] = configuredPaths ?? []
    if (this.isJavaScript && configuredPaths.length === 0) {
      watchPaths.push(joinPath('src', '**', '*.js'))
      watchPaths.push(joinPath('src', '**', '*.ts'))
    }
    watchPaths.push(joinPath('**', '!(.)*.graphql'))

    return watchPaths.map((path) => joinPath(this.directory, path))
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
    const outputFile = this.isThemeExtension ? '' : 'dist/main.js'

    if (this.features.includes('bundling')) {
      // Modules that are going to be inclued in the bundle should be built in the bundle directory
      this.outputPath = joinPath(bundleDirectory, extensionId, outputFile)
    }

    await this.build(options)

    if (this.isThemeExtension && useThemebundling()) {
      await bundleThemeExtension(this, options)
    }
  }

  async bundleConfig({identifiers, token, apiKey, unifiedDeployment}: ExtensionBundleConfigOptions) {
    const configValue = await this.deployConfig({apiKey, token, unifiedDeployment})
    if (!configValue) return undefined

    const {handle, ...remainingConfigs} = configValue
    const contextValue = (handle as string) || ''

    return {
      uuid: identifiers.extensions[this.localIdentifier]!,
      config: JSON.stringify(remainingConfigs),
      context: contextValue,
    }
  }
}

export interface ExtensionDeployConfigOptions {
  apiKey: string
  token: string
  unifiedDeployment: boolean
}

export interface ExtensionBundleConfigOptions {
  identifiers: Identifiers
  token: string
  apiKey: string
  unifiedDeployment: boolean
}
