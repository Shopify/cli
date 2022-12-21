import {BaseConfigContents, ZodSchemaType} from './schemas.js'
import {loadUIExtensionSpecifications} from './specifications.js'
import {ExtensionCategory, GenericSpecification, UIExtension} from '../app/extensions.js'
import {blocks, defualtExtensionFlavors} from '../../constants.js'
import {id, path, api, output, environment, string} from '@shopify/cli-kit'
import {ok, Result} from '@shopify/cli-kit/node/result'

/**
 * Extension specification with all the needed properties and methods to load an extension.
 */
export interface UIExtensionSpec<TConfiguration extends BaseConfigContents = BaseConfigContents>
  extends GenericSpecification {
  identifier: string
  externalIdentifier: string
  externalName: string
  partnersWebIdentifier: string
  surface: string
  showInCLIHelp: boolean
  singleEntryPath: boolean
  registrationLimit: number
  supportedFlavors: {name: string; value: string}[]
  gated: boolean
  helpURL?: string
  dependency?: {name: string; version: string}
  templatePath?: string
  graphQLType?: string
  schema: ZodSchemaType<TConfiguration>
  getBundleExtensionStdinContent?: (config: TConfiguration) => string
  deployConfig?: (config: TConfiguration, directory: string) => Promise<{[key: string]: unknown}>
  validate?: (config: TConfiguration, directory: string) => Promise<Result<unknown, string>>
  preDeployValidation?: (config: TConfiguration) => Promise<void>
  resourceUrl?: (config: TConfiguration) => string
  category: () => ExtensionCategory
  previewMessage?: (
    host: string,
    uuid: string,
    config: TConfiguration,
    storeFqdn: string,
  ) => output.TokenizedString | undefined
  shouldFetchCartUrl?(config: TConfiguration): boolean
  hasExtensionPointTarget?(config: TConfiguration, target: string): boolean
}

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
export class UIExtensionInstance<TConfiguration extends BaseConfigContents = BaseConfigContents>
  implements UIExtension<TConfiguration>
{
  entrySourceFilePath: string
  outputBundlePath: string
  devUUID: string
  localIdentifier: string
  idEnvironmentVariableName: string
  directory: string
  configuration: TConfiguration
  configurationPath: string

  private specification: UIExtensionSpec
  private remoteSpecification?: api.graphql.RemoteSpecification

  get graphQLType() {
    return (this.specification.graphQLType ?? this.specification.identifier).toUpperCase()
  }

  get identifier() {
    return this.specification.identifier
  }

  get type() {
    return this.specification.identifier
  }

  get humanName() {
    return this.remoteSpecification?.externalName ?? this.specification.externalName
  }

  get name() {
    return this.configuration.name
  }

  get dependency() {
    return this.specification.dependency
  }

  get externalType() {
    return this.remoteSpecification?.externalIdentifier ?? this.specification.externalIdentifier
  }

  get surface() {
    return this.specification.surface
  }

  constructor(options: {
    configuration: TConfiguration
    configurationPath: string
    entryPath: string
    directory: string
    specification: UIExtensionSpec
    remoteSpecification?: api.graphql.RemoteSpecification
  }) {
    this.configuration = options.configuration
    this.configurationPath = options.configurationPath
    this.entrySourceFilePath = options.entryPath
    this.directory = options.directory
    this.specification = options.specification
    this.remoteSpecification = options.remoteSpecification
    this.outputBundlePath = path.join(options.directory, 'dist/main.js')
    this.devUUID = `dev-${id.generateRandomUUID()}`
    this.localIdentifier = path.basename(options.directory)
    this.idEnvironmentVariableName = `SHOPIFY_${string.constantize(path.basename(this.directory))}_ID`
  }

  deployConfig(): Promise<{[key: string]: unknown}> {
    return this.specification.deployConfig?.(this.configuration, this.directory) ?? Promise.resolve({})
  }

  validate() {
    if (!this.specification.validate) return Promise.resolve(ok(undefined))
    return this.specification.validate(this.configuration, this.directory)
  }

  preDeployValidation() {
    if (!this.specification.preDeployValidation) return Promise.resolve()
    return this.specification.preDeployValidation(this.configuration)
  }

  async publishURL(options: {orgId: string; appId: string; extensionId?: string}) {
    const partnersFqdn = await environment.fqdn.partners()
    const parnersPath = this.specification.partnersWebIdentifier
    return `https://${partnersFqdn}/${options.orgId}/apps/${options.appId}/extensions/${parnersPath}/${options.extensionId}`
  }

  previewMessage(url: string, storeFqdn: string) {
    const heading = output.token.heading(`${this.name} (${this.humanName})`)
    let message = output.content`Preview link: ${url}/extensions/${this.devUUID}`

    if (this.specification.previewMessage) {
      const customMessage = this.specification.previewMessage(url, this.devUUID, this.configuration, storeFqdn)
      if (!customMessage) return
      message = customMessage
    }

    return output.content`${heading}\n${message.value}\n`
  }

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
}

/**
 * Find the registered spececification for a given extension type
 */
export async function uiSpecForType(type: string): Promise<UIExtensionSpec | undefined> {
  const allSpecifications = await loadUIExtensionSpecifications()
  return allSpecifications.find((spec) => spec.identifier === type || spec.externalIdentifier === type)
}

// PENDING: Fetch remote specs
function remoteSpecForType(type: string): api.graphql.RemoteSpecification | undefined {
  return undefined
}

export function createUIExtensionSpec<TConfiguration extends BaseConfigContents = BaseConfigContents>(spec: {
  identifier: string
  externalIdentifier: string
  partnersWebIdentifier: string
  surface: string
  externalName: string
  helpURL?: string
  supportedFlavors?: {name: string; value: string}[]
  showInCLIHelp?: boolean
  dependency?: {name: string; version: string}
  templatePath?: string
  graphQLType?: string
  singleEntryPath?: boolean
  schema: ZodSchemaType<TConfiguration>
  getBundleExtensionStdinContent?: (config: TConfiguration) => string
  validate?: (config: TConfiguration, directory: string) => Promise<Result<unknown, string>>
  deployConfig?: (config: TConfiguration, directory: string) => Promise<{[key: string]: unknown}>
  preDeployValidation?: (config: TConfiguration) => Promise<void>
  previewMessage?: (
    host: string,
    uuid: string,
    config: TConfiguration,
    storeFqdn: string,
  ) => output.TokenizedString | undefined
  shouldFetchCartUrl?(config: TConfiguration): boolean
  hasExtensionPointTarget?(config: TConfiguration, target: string): boolean
}): UIExtensionSpec<TConfiguration> {
  const defaults = {
    showInCLIHelp: true,
    singleEntryPath: true,
    gated: false,
    registrationLimit: blocks.extensions.defaultRegistrationLimit,
    supportedFlavors: defualtExtensionFlavors,
    category: (): ExtensionCategory => (spec.identifier === 'theme' ? 'theme' : 'ui'),
  }
  return {...defaults, ...spec}
}
