import {ZodSchemaType, BaseConfigContents, BaseUIExtensionSchema} from './schemas.js'
import {ExtensionCategory, ExtensionFlavor, GenericSpecification, UIExtension} from '../app/extensions.js'
import {blocks, defaultExtensionFlavors} from '../../constants.js'
import {ok, Result} from '@shopify/cli-kit/node/result'
import {capitalize, constantize} from '@shopify/cli-kit/common/string'
import {randomUUID} from '@shopify/cli-kit/node/crypto'
import {partnersFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {joinPath, basename} from '@shopify/cli-kit/node/path'
import {outputContent, outputToken, TokenizedString} from '@shopify/cli-kit/node/output'

/**
 * Extension specification with all the needed properties and methods to load an extension.
 */
export interface UIExtensionSpec<TConfiguration extends BaseConfigContents = BaseConfigContents>
  extends GenericSpecification {
  identifier: string
  partnersWebIdentifier: string
  surface: string
  singleEntryPath: boolean
  registrationLimit: number
  supportedFlavors: ExtensionFlavor[]
  gated: boolean
  helpURL?: string
  dependency?: string
  templatePath?: string
  graphQLType?: string
  schema: ZodSchemaType<TConfiguration>
  getBundleExtensionStdinContent?: (config: TConfiguration) => string
  deployConfig?: (config: TConfiguration, directory: string) => Promise<{[key: string]: unknown}>
  validate?: (config: TConfiguration, directory: string) => Promise<Result<unknown, string>>
  preDeployValidation?: (extension: UIExtensionInstance<TConfiguration>) => Promise<void>
  buildValidation?: (extension: UIExtensionInstance<TConfiguration>) => Promise<void>
  category: () => ExtensionCategory
  previewMessage?: (
    host: string,
    uuid: string,
    config: TConfiguration,
    storeFqdn: string,
  ) => TokenizedString | undefined
  shouldFetchCartUrl?(config: TConfiguration): boolean
  hasExtensionPointTarget?(config: TConfiguration, target: string): boolean
  isPreviewable: boolean
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
    return this.specification.isPreviewable
  }

  constructor(options: {
    configuration: TConfiguration
    configurationPath: string
    entryPath: string
    directory: string
    specification: UIExtensionSpec
  }) {
    this.configuration = options.configuration
    this.configurationPath = options.configurationPath
    this.entrySourceFilePath = options.entryPath
    this.directory = options.directory
    this.specification = options.specification
    this.outputBundlePath = joinPath(options.directory, 'dist/main.js')
    this.devUUID = `dev-${randomUUID()}`
    this.localIdentifier = basename(options.directory)
    this.idEnvironmentVariableName = `SHOPIFY_${constantize(basename(this.directory))}_ID`
  }

  deployConfig(): Promise<{[key: string]: unknown}> {
    return this.specification.deployConfig?.(this.configuration, this.directory) ?? Promise.resolve({})
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
 * These fields are forbidden when creating a new ExtensionSpec
 * They belong to the ExtensionSpec interface, but the values are obtained from the API
 * and should not be set by the user locally
 *
 * WARNING: 'surface' should be included here but is not yet compatible with the extension server
 */
export type ForbiddenFields = 'registrationLimit' | 'category' | 'externalIdentifier' | 'externalName' | 'name'

/**
 * Partial ExtensionSpec type used when creating a new ExtensionSpec, the only mandatory field is the identifier
 */
export interface CreateExtensionSpecType<TConfiguration extends BaseConfigContents = BaseConfigContents>
  extends Partial<Omit<UIExtensionSpec<TConfiguration>, ForbiddenFields>> {
  identifier: string
}

/**
 * Create a new ui extension spec.
 *
 * Everything but "identifer" is optional.
 * ```ts
 * identifier: string // unique identifier for the extension type
 * externalIdentifier: string // identifier used externally (default: same as "identifier")
 * partnersWebIdentifier: string // identifier used in the partners web UI (default: same as "identifier")
 * surface?: string // surface where the extension is going to be rendered (default: 'unknown')
 * singleEntryPath: boolean // whether the extension has a single entry point (default: true)
 * supportedFlavors: {name: string; value: string}[] // list of supported flavors (default: 'javascript', 'typescript', 'typescript-react', 'javascript-react')
 * helpURL?: string // url to the help page for the extension, shown after generating the extension
 * dependency?: {name: string; version: string} // dependency to be added to the extension's package.json
 * templatePath?: string // path to the template to be used when generating the extension
 * graphQLType?: string // GraphQL type of the extension (default: same as "identifier")
 * schema?: ZodSchemaType<TConfiguration> // schema used to validate the extension's configuration (default: BaseUIExtensionSchema)
 * getBundleExtensionStdinContent?: (configuration: TConfiguration) => string // function to generate the content of the stdin file used to bundle the extension
 * validate?: (configuration: TConfiguration, directory: string) => Promise<Result<undefined, Error>> // function to validate the extension's configuration
 * preDeployValidation?: (configuration: TConfiguration) => Promise<void> // function to validate the extension's configuration before deploying it
 * deployConfig?: (configuration: TConfiguration, directory: string) => Promise<{[key: string]: unknown}> // function to generate the extensions configuration payload to be deployed
 * previewMessage?: (url: string, devUUID: string, configuration: TConfiguration, storeFqdn: string) => string | undefined // function to generate the preview message shown to the user during `dev`
 * shouldFetchCartUrl?: (configuration: TConfiguration) => boolean // function to determine if the extension should fetch the cart url
 * hasExtensionPointTarget?: (configuration: TConfiguration, target: string) => boolean // function to determine if the extension has a given extension point target
 * ```
 */
export function createUIExtensionSpecification<TConfiguration extends BaseConfigContents = BaseConfigContents>(
  spec: CreateExtensionSpecType<TConfiguration>,
): UIExtensionSpec<TConfiguration> {
  const defaults = {
    // these two fields are going to be overridden by the extension specification API response,
    // but we need them to have a default value for tests
    externalIdentifier: `${spec.identifier}_external`,
    externalName: capitalize(spec.identifier.replace(/_/g, ' ')),
    surface: 'unknown',
    partnersWebIdentifier: spec.identifier,
    singleEntryPath: true,
    gated: false,
    schema: BaseUIExtensionSchema as ZodSchemaType<TConfiguration>,
    registrationLimit: blocks.extensions.defaultRegistrationLimit,
    supportedFlavors: defaultExtensionFlavors,
    category: (): ExtensionCategory => (spec.identifier === 'theme' ? 'theme' : 'ui'),
    isPreviewable: false,
  }
  return {...defaults, ...spec}
}
