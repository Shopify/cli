import {BaseConfigType, MAX_EXTENSION_HANDLE_LENGTH, MAX_UID_LENGTH} from './schemas.js'
import {FunctionConfigType} from './specifications/function.js'
import {SingleWebhookSubscriptionType} from './specifications/app_config_webhook_schemas/webhooks_schema.js'
import {ExtensionBuildOptions, bundleFunctionExtension} from '../../services/build/extension.js'
import {bundleThemeExtension} from '../../services/extensions/bundle.js'
import {Identifiers} from '../app/identifiers.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {AppConfiguration} from '../app/app.js'
import {ApplicationURLs} from '../../services/dev/urls.js'
import {executeStep, BuildContext, ClientSteps} from '../../services/build/client-steps.js'
import {RemoteSpecification} from '../../api/graphql/extension_specifications.js'
import {ok, Result} from '@shopify/cli-kit/node/result'
import {constantize, slugify} from '@shopify/cli-kit/common/string'
import {hashString, nonRandomUUID} from '@shopify/cli-kit/node/crypto'
import {partnersFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {joinPath, normalizePath, resolvePath, relativePath, basename} from '@shopify/cli-kit/node/path'
import {fileExists, moveFile, glob, copyFile, globSync} from '@shopify/cli-kit/node/fs'
import {getPathValue} from '@shopify/cli-kit/common/object'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {
  extractJSImports,
  extractImportPathsRecursively,
  clearImportPathsCache,
  getImportScanningCacheStats,
} from '@shopify/cli-kit/node/import-extractor'
import {isTruthy} from '@shopify/cli-kit/node/context/utilities'
import {uniq} from '@shopify/cli-kit/common/array'

export type ExtensionFeature =
  | 'ui_preview'
  | 'function'
  | 'theme'
  | 'cart_url'
  | 'esbuild'
  | 'single_js_entry_path'
  | 'localization'
  | 'generates_source_maps'

export type ExtensionExperience = 'extension' | 'configuration'
export type UidStrategy = 'single' | 'dynamic' | 'uuid'

export type BuildConfig =
  | {mode: 'ui' | 'theme' | 'function' | 'tax_calculation' | 'none' | 'hosted_app_home'}
  | {mode: 'copy_files'; filePatterns: string[]; ignoredFilePatterns?: string[]}

export enum AssetIdentifier {
  ShouldRender = 'should_render',
  Main = 'main',
  Tools = 'tools',
  Instructions = 'instructions',
}

export interface Asset {
  identifier: AssetIdentifier
  outputFileName: string
  content: string
}

export interface DevSessionWatchConfig {
  paths: string[]
  ignore?: string[]
}

/**
 * Base class for all application modules (extensions and config modules).
 *
 * Subclasses override behavior methods (appModuleFeatures, deployConfig, validate, etc.)
 * while the base class provides shared infrastructure (build pipeline, file watching,
 * handle/uid computation, bundling).
 *
 * This replaces the old ExtensionInstance + ExtensionSpecification composition pattern
 * with a cleaner inheritance model where per-type behavior lives in subclasses.
 */
export abstract class ApplicationModule<TConfiguration extends BaseConfigType = BaseConfigType> {
  entrySourceFilePath: string
  devUUID: string
  localIdentifier: string
  idEnvironmentVariableName: string
  directory: string
  configuration: TConfiguration
  configurationPath: string
  outputPath: string
  handle: string
  uid: string
  readonly remoteSpec: RemoteSpecification
  private cachedImportPaths?: string[]

  constructor(options: {
    configuration: TConfiguration
    configurationPath: string
    entryPath?: string
    directory: string
    remoteSpec: RemoteSpecification
  }) {
    this.configuration = options.configuration
    this.configurationPath = options.configurationPath
    this.entrySourceFilePath = options.entryPath ?? ''
    this.directory = options.directory
    this.remoteSpec = options.remoteSpec
    this.handle = this.buildHandle()
    this.localIdentifier = this.handle
    this.idEnvironmentVariableName = `SHOPIFY_${constantize(this.localIdentifier)}_ID`
    this.outputPath = joinPath(this.directory, this.outputRelativePath)
    this.uid = this.buildUIDFromStrategy()
    this.devUUID = `dev-${this.uid}`
  }

  // ------------------------------------------------------------------
  // Abstract: subclasses must define
  // ------------------------------------------------------------------

  abstract appModuleFeatures(): ExtensionFeature[]

  // ------------------------------------------------------------------
  // Identity — defaults delegate to remoteSpec. Subclasses can override.
  // SpecificationBackedExtension overrides these to delegate to its
  // ExtensionSpecification instead.
  // ------------------------------------------------------------------

  get identifier(): string {
    return this.remoteSpec.identifier
  }

  get externalIdentifier(): string {
    return this.remoteSpec.externalIdentifier
  }

  get externalName(): string {
    return this.remoteSpec.externalName
  }

  get partnersWebIdentifier(): string {
    return this.remoteSpec.identifier
  }

  get experience(): ExtensionExperience {
    return this.remoteSpec.experience as ExtensionExperience
  }

  get uidStrategy(): UidStrategy {
    return this.remoteSpec.uidStrategy
  }

  get surface(): string {
    return this.remoteSpec.surface ?? ''
  }

  get graphQLType(): string {
    return this.identifier.toUpperCase()
  }

  get type(): string {
    return this.identifier
  }

  get humanName(): string {
    return this.externalName
  }

  get name(): string {
    return this.configuration.name ?? this.externalName
  }

  get dependency(): string | undefined {
    return undefined
  }

  get externalType(): string {
    return this.externalIdentifier
  }

  // ------------------------------------------------------------------
  // Feature queries — derived from appModuleFeatures()
  // ------------------------------------------------------------------

  get features(): ExtensionFeature[] {
    return this.appModuleFeatures()
  }

  get isPreviewable(): boolean {
    return this.features.includes('ui_preview')
  }

  get isThemeExtension(): boolean {
    return this.features.includes('theme')
  }

  get isFunctionExtension(): boolean {
    return this.features.includes('function')
  }

  get isESBuildExtension(): boolean {
    return this.features.includes('esbuild')
  }

  get isSourceMapGeneratingExtension(): boolean {
    return this.features.includes('generates_source_maps')
  }

  get isAppConfigExtension(): boolean {
    return this.experience === 'configuration'
  }

  get isFlow(): boolean {
    return this.identifier.includes('flow')
  }

  get isEditorExtensionCollection(): boolean {
    return this.identifier === 'editor_extension_collection'
  }

  // ------------------------------------------------------------------
  // Build configuration — subclasses override
  // ------------------------------------------------------------------

  get buildConfig(): BuildConfig {
    return {mode: 'none'}
  }

  get clientSteps(): ClientSteps | undefined {
    return undefined
  }

  get outputRelativePath(): string {
    return ''
  }

  get outputFileName(): string {
    return basename(this.outputRelativePath)
  }

  // ------------------------------------------------------------------
  // UID strategy queries
  // ------------------------------------------------------------------

  get isUUIDStrategyExtension(): boolean {
    return this.uidStrategy === 'uuid'
  }

  get isSingleStrategyExtension(): boolean {
    return this.uidStrategy === 'single'
  }

  get isDynamicStrategyExtension(): boolean {
    return this.uidStrategy === 'dynamic'
  }

  // ------------------------------------------------------------------
  // Display / metrics helpers
  // ------------------------------------------------------------------

  get outputPrefix(): string {
    return this.handle
  }

  get draftMessages() {
    if (this.isAppConfigExtension) return {successMessage: undefined, errorMessage: undefined}
    const successMessage = `Draft updated successfully for extension: ${this.localIdentifier}`
    const errorMessage = `Error updating extension draft for ${this.localIdentifier}`
    return {successMessage, errorMessage}
  }

  isSentToMetrics(): boolean {
    return !this.isAppConfigExtension
  }

  isReturnedAsInfo(): boolean {
    return !this.isAppConfigExtension
  }

  // ------------------------------------------------------------------
  // Lifecycle hooks — subclasses override as needed
  // ------------------------------------------------------------------

  async deployConfig(_options: ExtensionDeployConfigOptions): Promise<{[key: string]: unknown} | undefined> {
    return undefined
  }

  validate(): Promise<Result<unknown, string>> {
    return Promise.resolve(ok(undefined))
  }

  preDeployValidation(): Promise<void> {
    return Promise.resolve()
  }

  buildValidation(): Promise<void> {
    return Promise.resolve()
  }

  // ------------------------------------------------------------------
  // UI extension hooks — subclasses override as needed
  // ------------------------------------------------------------------

  getBundleExtensionStdinContent(): {main: string; assets?: Asset[]} {
    const relativeImportPath = this.entrySourceFilePath.replace(this.directory, '')
    return {main: `import '.${relativeImportPath}';`}
  }

  shouldFetchCartUrl(): boolean {
    return this.features.includes('cart_url')
  }

  hasExtensionPointTarget(_target: string): boolean {
    return false
  }

  // ------------------------------------------------------------------
  // Config transform hooks — subclasses override as needed
  // ------------------------------------------------------------------

  transformLocalToRemote(_appConfiguration: AppConfiguration): object | undefined {
    return undefined
  }

  transformRemoteToLocal(_options?: {flags?: unknown[]}): object | undefined {
    return undefined
  }

  patchWithAppDevURLs(_urls: ApplicationURLs): void {}

  async getDevSessionUpdateMessages(): Promise<string[] | undefined> {
    return undefined
  }

  async contributeToSharedTypeFile(_typeDefinitionsByFile: Map<string, Set<string>>): Promise<void> {}

  async copyStaticAssets(_outputPath?: string): Promise<void> {}

  // ------------------------------------------------------------------
  // Watch configuration
  // ------------------------------------------------------------------

  devSessionDefaultWatchPaths(): string[] {
    if (this.identifier === 'ui_extension') {
      const {main, assets} = this.getBundleExtensionStdinContent()
      const mainPaths = extractJSImports(main, this.directory)
      const assetPaths = assets?.flatMap((asset) => extractJSImports(asset.content, this.directory)) ?? []
      return mainPaths.concat(...assetPaths)
    }
    return [this.entrySourceFilePath]
  }

  get devSessionWatchConfig(): DevSessionWatchConfig | undefined {
    return this.experience === 'configuration' ? {paths: []} : undefined
  }

  async watchConfigurationPaths(): Promise<string[]> {
    if (this.isAppConfigExtension) {
      return [this.configurationPath]
    }
    const additionalPaths = []
    if (await fileExists(joinPath(this.directory, 'locales'))) {
      additionalPaths.push(joinPath(this.directory, 'locales', '**.json'))
    }
    additionalPaths.push(joinPath(this.directory, '**.toml'))
    return additionalPaths
  }

  // ------------------------------------------------------------------
  // Function-specific properties (accessed via config cast)
  // ------------------------------------------------------------------

  get buildCommand(): string | undefined {
    const config = this.configuration as unknown as FunctionConfigType
    return config.build?.command
  }

  get typegenCommand(): string | undefined {
    const config = this.configuration as unknown as FunctionConfigType
    return config.build?.typegen_command
  }

  get inputQueryPath(): string {
    return joinPath(this.directory, 'input.graphql')
  }

  get isJavaScript(): boolean {
    return Boolean(this.entrySourceFilePath.endsWith('.js') || this.entrySourceFilePath.endsWith('.ts'))
  }

  // ------------------------------------------------------------------
  // Build pipeline — shared infrastructure, not overridden
  // ------------------------------------------------------------------

  async build(options: ExtensionBuildOptions): Promise<void> {
    const {clientSteps = []} = {clientSteps: this.clientSteps}

    const context: BuildContext = {
      extension: this as unknown as Parameters<typeof executeStep>[1]['extension'],
      options,
      stepResults: new Map(),
    }

    const steps = clientSteps.find((lifecycle) => lifecycle.lifecycle === 'deploy')?.steps ?? []

    for (const step of steps) {
      // eslint-disable-next-line no-await-in-loop
      const result = await executeStep(step, context)
      context.stepResults.set(step.id, result)

      if (!result.success && !step.continueOnError) {
        throw new Error(`Build step "${step.name}" failed: ${result.error?.message}`)
      }
    }
  }

  async buildForBundle(options: ExtensionBuildOptions, bundleDirectory: string, outputId?: string): Promise<void> {
    this.outputPath = this.getOutputPathForDirectory(bundleDirectory, outputId)
    await this.build(options)

    const bundleInputPath = joinPath(bundleDirectory, this.getOutputFolderId(outputId))
    await this.keepBuiltSourcemapsLocally(bundleInputPath)
  }

  async copyIntoBundle(options: ExtensionBuildOptions, bundleDirectory: string, extensionUuid?: string): Promise<void> {
    const defaultOutputPath = this.outputPath

    this.outputPath = this.getOutputPathForDirectory(bundleDirectory, extensionUuid)

    const buildMode = this.buildConfig.mode

    if (this.isThemeExtension) {
      await bundleThemeExtension(this as unknown as Parameters<typeof bundleThemeExtension>[0], options)
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

  // ------------------------------------------------------------------
  // Output path helpers
  // ------------------------------------------------------------------

  getOutputPathForDirectory(directory: string, outputId?: string): string {
    const id = this.getOutputFolderId(outputId)
    return joinPath(directory, id, this.outputRelativePath)
  }

  getOutputFolderId(outputId?: string): string {
    return outputId ?? this.uid
  }

  // ------------------------------------------------------------------
  // Targeting / context
  // ------------------------------------------------------------------

  get singleTarget(): string | undefined {
    const targets = (getPathValue(this.configuration, 'targeting') as {target: string}[]) ?? []
    if (targets.length !== 1) return undefined
    return targets[0]?.target
  }

  get contextValue(): string {
    let context = this.singleTarget ?? ''
    if (this.isFlow) context = this.configuration.handle ?? ''
    return context
  }

  // ------------------------------------------------------------------
  // Bundle / deploy
  // ------------------------------------------------------------------

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

  async publishURL(options: {orgId: string; appId: string; extensionId?: string}): Promise<string> {
    const fqdn = await partnersFqdn()
    const parnersPath = this.partnersWebIdentifier
    return `https://${fqdn}/${options.orgId}/apps/${options.appId}/extensions/${parnersPath}/${options.extensionId}`
  }

  // ------------------------------------------------------------------
  // Source maps
  // ------------------------------------------------------------------

  async keepBuiltSourcemapsLocally(inputPath: string): Promise<void> {
    if (!this.isSourceMapGeneratingExtension) return

    const pathsToMove = await glob(`**/${this.handle}.js.map`, {
      cwd: inputPath,
      absolute: true,
      followSymbolicLinks: false,
    })

    const pathToMove = pathsToMove[0]
    if (pathToMove === undefined) return

    const outputPathForMap = joinPath(this.directory, relativePath(inputPath, pathToMove))
    await moveFile(pathToMove, outputPathForMap, {overwrite: true})
    outputDebug(`Source map for ${this.localIdentifier} created: ${outputPathForMap}`)
  }

  // ------------------------------------------------------------------
  // File watching
  // ------------------------------------------------------------------

  watchedFiles(): string[] {
    const watchedFiles: string[] = []

    const defaultIgnore = [
      '**/node_modules/**',
      '**/.git/**',
      '**/*.test.*',
      '**/dist/**',
      '**/*.swp',
      '**/generated/**',
      '**/.gitignore',
    ]
    const watchConfig = this.devSessionWatchConfig

    const patterns = watchConfig?.paths ?? ['**/*']
    const ignore = watchConfig?.ignore ?? defaultIgnore
    const files = patterns.flatMap((pattern) =>
      globSync(pattern, {
        cwd: this.directory,
        absolute: true,
        followSymbolicLinks: false,
        ignore,
      }),
    )
    watchedFiles.push(...files.flat())

    if (!watchConfig) {
      const importedFiles = this.scanImports()
      watchedFiles.push(...importedFiles)
    }

    return [...new Set(watchedFiles.map((file) => normalizePath(file)))]
  }

  async rescanImports(): Promise<boolean> {
    const oldImportPaths = this.cachedImportPaths
    this.cachedImportPaths = undefined
    clearImportPathsCache()
    this.scanImports()
    return oldImportPaths !== this.cachedImportPaths
  }

  // ------------------------------------------------------------------
  // Handle / UID computation
  // ------------------------------------------------------------------

  protected buildHandle(): string {
    switch (this.uidStrategy) {
      case 'single':
        return this.identifier
      case 'uuid':
        return this.configuration.handle ?? slugify(this.name ?? '')
      case 'dynamic':
        if ('topic' in this.configuration && 'uri' in this.configuration) {
          const subscription = this.configuration as unknown as SingleWebhookSubscriptionType
          const handleStr = `${subscription.topic}${subscription.uri}${subscription.filter}`
          return hashString(handleStr).substring(0, MAX_EXTENSION_HANDLE_LENGTH)
        }
        return nonRandomUUID(JSON.stringify(this.configuration))
      default:
        return this.identifier
    }
  }

  protected buildUIDFromStrategy(): string {
    switch (this.uidStrategy) {
      case 'single':
        return this.identifier
      case 'uuid':
        return this.configuration.uid ?? nonRandomUUID(this.handle)
      case 'dynamic':
        if ('topic' in this.configuration && 'uri' in this.configuration) {
          const subscription = this.configuration as unknown as SingleWebhookSubscriptionType
          return `${subscription.topic}::${subscription.filter}::${subscription.uri}`.substring(0, MAX_UID_LENGTH)
        }
        return nonRandomUUID(JSON.stringify(this.configuration))
    }
  }

  private scanImports(): string[] {
    if (this.cachedImportPaths !== undefined) {
      return this.cachedImportPaths
    }

    if (isTruthy(process.env.SHOPIFY_CLI_DISABLE_IMPORT_SCANNING)) {
      this.cachedImportPaths = []
      return this.cachedImportPaths
    }

    try {
      const startTime = performance.now()
      const entryFiles = this.devSessionDefaultWatchPaths()

      const imports = entryFiles.flatMap((entryFile) => {
        return extractImportPathsRecursively(entryFile).map((importPath) => normalizePath(resolvePath(importPath)))
      })

      this.cachedImportPaths = uniq(imports) ?? []
      const elapsed = Math.round(performance.now() - startTime)
      const cacheStats = getImportScanningCacheStats()
      const cacheInfo = cacheStats ? ` (cache: ${cacheStats.directImports} parsed, ${cacheStats.fileExists} stats)` : ''
      outputDebug(
        `Import scan for "${this.handle}": ${entryFiles.length} entries, ${this.cachedImportPaths.length} files, ${elapsed}ms${cacheInfo}`,
      )
      return this.cachedImportPaths
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      outputDebug(`Failed to scan imports for extension ${this.handle}: ${error}`)
      this.cachedImportPaths = []
      return this.cachedImportPaths
    }
  }
}

// ------------------------------------------------------------------
// Supporting types
// ------------------------------------------------------------------

export interface ExtensionDeployConfigOptions {
  apiKey: string
  appConfiguration: AppConfiguration
}

interface ExtensionBundleConfigOptions {
  identifiers: Identifiers
  developerPlatformClient: DeveloperPlatformClient
  apiKey: string
  appConfiguration: AppConfiguration
}

interface BundleConfig {
  config: string
  context: string
  handle: string
  uid: string
  uuid: string
  specificationIdentifier: string
}
