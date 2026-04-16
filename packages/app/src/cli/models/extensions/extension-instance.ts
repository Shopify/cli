import {BaseConfigType} from './schemas.js'
import {ApplicationModule, ExtensionDeployConfigOptions} from './application-module.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {ExtensionFeature, ExtensionSpecification, DevSessionWatchConfig} from './specification.js'
import {Flag} from '../../utilities/developer-platform-client.js'
import {AppConfiguration} from '../app/app.js'
import {ApplicationURLs} from '../../services/dev/urls.js'
import {ok, Result} from '@shopify/cli-kit/node/result'

/**
 * Backward-compatible class that bridges the old ExtensionSpecification-based
 * composition pattern with the new ApplicationModule inheritance model.
 *
 * This class extends ApplicationModule and delegates identity/behavior to the
 * existing ExtensionSpecification object, preserving the current API surface
 * for all 76+ consuming files.
 *
 * Once all specs are migrated to ApplicationModule subclasses, this class
 * will be removed and consumers will use ApplicationModule directly.
 */
export class ExtensionInstance<TConfiguration extends BaseConfigType = BaseConfigType> extends ApplicationModule<TConfiguration> {
  specification: ExtensionSpecification

  constructor(options: {
    configuration: TConfiguration
    configurationPath: string
    entryPath?: string
    directory: string
    specification: ExtensionSpecification
  }) {
    super({
      ...options,
      remoteSpec: {
        name: options.specification.externalName,
        externalName: options.specification.externalName,
        identifier: options.specification.identifier,
        gated: false,
        externalIdentifier: options.specification.externalIdentifier,
        experience: options.specification.experience,
        managementExperience: 'cli',
        registrationLimit: options.specification.registrationLimit,
        uidStrategy: options.specification.uidStrategy,
        surface: options.specification.surface,
      },
    })
    this.specification = options.specification
    // Recompute outputPath now that specification is set, since the
    // override of outputRelativePath delegates to specification.
    this.outputPath = joinPath(this.directory, this.outputRelativePath)
  }

  // ------------------------------------------------------------------
  // Identity — delegates to specification for backward compatibility.
  // Uses ?. fallback to remoteSpec during construction (before
  // this.specification is set by the subclass constructor).
  // ------------------------------------------------------------------

  override get identifier(): string {
    return this.specification?.identifier ?? this.remoteSpec.identifier
  }

  override get externalIdentifier(): string {
    return this.specification?.externalIdentifier ?? this.remoteSpec.externalIdentifier
  }

  override get externalName(): string {
    return this.specification?.externalName ?? this.remoteSpec.externalName
  }

  override get partnersWebIdentifier(): string {
    return this.specification?.partnersWebIdentifier ?? this.remoteSpec.identifier
  }

  override get graphQLType(): string {
    if (!this.specification) return this.remoteSpec.identifier.toUpperCase()
    return (this.specification.graphQLType ?? this.specification.identifier).toUpperCase()
  }

  override get experience() {
    return (this.specification?.experience ?? this.remoteSpec.experience) as 'extension' | 'configuration'
  }

  override get uidStrategy() {
    return this.specification?.uidStrategy ?? this.remoteSpec.uidStrategy
  }

  override get surface(): string {
    return this.specification?.surface ?? this.remoteSpec.surface ?? ''
  }

  override get dependency(): string | undefined {
    return this.specification?.dependency
  }

  // ------------------------------------------------------------------
  // Behavior — delegates to specification
  // ------------------------------------------------------------------

  appModuleFeatures(): ExtensionFeature[] {
    return this.specification.appModuleFeatures(this.configuration)
  }

  override get buildConfig() {
    return this.specification.buildConfig
  }

  override get clientSteps() {
    return this.specification.clientSteps
  }

  override get outputRelativePath(): string {
    return this.specification?.getOutputRelativePath?.(this) ?? ''
  }

  override async deployConfig({
    apiKey,
    appConfiguration,
  }: ExtensionDeployConfigOptions): Promise<{[key: string]: unknown} | undefined> {
    const deployConfigResult = await this.specification.deployConfig?.(this.configuration, this.directory, apiKey, undefined)
    const transformedConfig = this.specification.transformLocalToRemote?.(this.configuration, appConfiguration) as
      | {[key: string]: unknown}
      | undefined
    const resultDeployConfig = deployConfigResult ?? transformedConfig ?? undefined
    return resultDeployConfig && Object.keys(resultDeployConfig).length > 0 ? resultDeployConfig : undefined
  }

  override validate(): Promise<Result<unknown, string>> {
    if (!this.specification.validate) return Promise.resolve(ok(undefined))
    return this.specification.validate(this.configuration, this.configurationPath, this.directory)
  }

  override preDeployValidation(): Promise<void> {
    if (!this.specification.preDeployValidation) return Promise.resolve()
    return this.specification.preDeployValidation(this)
  }

  override buildValidation(): Promise<void> {
    if (!this.specification.buildValidation) return Promise.resolve()
    return this.specification.buildValidation(this)
  }

  override getBundleExtensionStdinContent() {
    if (this.specification.getBundleExtensionStdinContent) {
      return this.specification.getBundleExtensionStdinContent(this.configuration)
    }
    return super.getBundleExtensionStdinContent()
  }

  override hasExtensionPointTarget(target: string): boolean {
    return this.specification.hasExtensionPointTarget?.(this.configuration, target) ?? false
  }

  override transformLocalToRemote(appConfiguration: AppConfiguration): object | undefined {
    return this.specification.transformLocalToRemote?.(this.configuration, appConfiguration)
  }

  override transformRemoteToLocal(options?: {flags?: Flag[]}): object | undefined {
    return this.specification.transformRemoteToLocal?.(this.configuration, options)
  }

  override patchWithAppDevURLs(urls: ApplicationURLs): void {
    if (!this.specification.patchWithAppDevURLs) return
    this.specification.patchWithAppDevURLs(this.configuration, urls)
  }

  override async getDevSessionUpdateMessages(): Promise<string[] | undefined> {
    if (!this.specification.getDevSessionUpdateMessages) return undefined
    return this.specification.getDevSessionUpdateMessages(this.configuration)
  }

  override async contributeToSharedTypeFile(typeDefinitionsByFile: Map<string, Set<string>>): Promise<void> {
    await this.specification.contributeToSharedTypeFile?.(this, typeDefinitionsByFile)
  }

  override async copyStaticAssets(outputPath?: string): Promise<void> {
    if (this.specification.copyStaticAssets) {
      return this.specification.copyStaticAssets(this.configuration, this.directory, outputPath ?? this.outputPath)
    }
  }

  override get devSessionWatchConfig(): DevSessionWatchConfig | undefined {
    if (this.specification.devSessionWatchConfig) {
      return this.specification.devSessionWatchConfig(this)
    }
    return super.devSessionWatchConfig
  }
}
