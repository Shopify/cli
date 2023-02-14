import {ZodSchemaType, BaseConfigurationExtensionSchema} from './schemas.js'
import {ExtensionCategory, GenericSpecification, ConfigurationExtension} from '../app/extensions.js'
import {blocks} from '../../constants.js'
import {capitalize, constantize} from '@shopify/cli-kit/common/string'
import {randomUUID} from '@shopify/cli-kit/node/crypto'
import {partnersFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {basename} from '@shopify/cli-kit/node/path'
import {outputContent, outputToken, TokenizedString} from '@shopify/cli-kit/node/output'
import {schema} from '@shopify/cli-kit/node/schema'

// Base config type that all config schemas must extend
export type ConfigurationExtensionConfigType = schema.infer<typeof BaseConfigurationExtensionSchema>

/**
 * Extension specification with all the needed properties and methods to load an extension.
 */
export interface ConfigurationExtensionSpec<
  TConfiguration extends ConfigurationExtensionConfigType = ConfigurationExtensionConfigType,
> extends GenericSpecification {
  identifier: string
  partnersWebIdentifier: string
  surface: string
  registrationLimit: number
  helpURL?: string
  templatePath?: string
  schema: ZodSchemaType<TConfiguration>
  deployConfig?: (config: TConfiguration, directory: string) => Promise<{[key: string]: unknown}>
  category: () => ExtensionCategory
  previewMessage?: (
    host: string,
    uuid: string,
    config: TConfiguration,
    storeFqdn: string,
  ) => TokenizedString | undefined
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
export class ConfigurationExtensionInstance<
  TConfiguration extends ConfigurationExtensionConfigType = ConfigurationExtensionConfigType,
> implements ConfigurationExtension<TConfiguration>
{
  devUUID: string
  localIdentifier: string
  idEnvironmentVariableName: string
  directory: string
  configuration: TConfiguration
  configurationPath: string

  private specification: ConfigurationExtensionSpec

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

  get externalType() {
    return this.specification.externalIdentifier
  }

  get surface() {
    return this.specification.surface
  }

  constructor(options: {
    configuration: TConfiguration
    configurationPath: string
    directory: string
    specification: ConfigurationExtensionSpec
  }) {
    this.configuration = options.configuration
    this.configurationPath = options.configurationPath
    this.directory = options.directory
    this.specification = options.specification
    this.devUUID = `dev-${randomUUID()}`
    this.localIdentifier = basename(options.directory)
    this.idEnvironmentVariableName = `SHOPIFY_${constantize(basename(this.directory))}_ID`
  }

  get graphQLType() {
    return this.specification.identifier.toUpperCase()
  }

  deployConfig(): Promise<{[key: string]: unknown}> {
    return this.specification.deployConfig?.(this.configuration, this.directory) ?? Promise.resolve({})
  }

  async publishURL(options: {orgId: string; appId: string; extensionId?: string}) {
    const fqdn = await partnersFqdn()
    const partnersPath = this.specification.partnersWebIdentifier
    return `https://${fqdn}/${options.orgId}/apps/${options.appId}/extensions/${partnersPath}/${options.extensionId}`
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
}

/**
 * Partial FunctionSpec type used when creating a new FunctionSpec, the only mandatory fields are the identifier and the schema
 */
export interface CreateConfigurationExtensionSpecType<
  TConfiguration extends ConfigurationExtensionConfigType = ConfigurationExtensionConfigType,
> extends Partial<ConfigurationExtensionSpec<TConfiguration>> {
  identifier: string
  schema: ZodSchemaType<TConfiguration>
}

/**
 * Create a new configuration extension spec.
 *
 * Everything but "identifer" and schema are optional.
 * ```ts
 * identifier: string // unique identifier for the extension type
 * externalIdentifier: string // identifier used externally (default: same as "identifier")
 * partnersWebIdentifier: string // identifier used in the partners web UI (default: same as "identifier")
 * surface?: string // surface where the extension is going to be rendered (default: 'unknown')
 * schema?: ZodSchemaType<TConfiguration> // schema used to validate the extension's configuration (default: BaseConfigurationExtensionSchema)
 * deployConfig?: (configuration: TConfiguration, directory: string) => Promise<{[key: string]: unknown}> // function to generate the extensions configuration payload to be deployed
 * previewMessage?: (url: string, devUUID: string, configuration: TConfiguration, storeFqdn: string) => string | undefined // function to generate the preview message shown to the user during `dev`
 * ```
 */
export function createConfigurationExtensionSpecification<
  TConfiguration extends ConfigurationExtensionConfigType = ConfigurationExtensionConfigType,
>(spec: CreateConfigurationExtensionSpecType<TConfiguration>): ConfigurationExtensionSpec<TConfiguration> {
  const defaults = {
    // these two fields are going to be overridden by the extension specification API response,
    // but we need them to have a default value for tests
    externalIdentifier: `${spec.identifier}_external`,
    externalName: capitalize(spec.identifier.replace(/_/g, ' ')),
    surface: 'unknown',
    partnersWebIdentifier: spec.identifier,
    gated: false,
    schema: BaseConfigurationExtensionSchema as ZodSchemaType<TConfiguration>,
    registrationLimit: blocks.extensions.defaultRegistrationLimit,
    supportedFlavors: [],
    category: (): ExtensionCategory => 'configuration',
  }
  return {...defaults, ...spec}
}
