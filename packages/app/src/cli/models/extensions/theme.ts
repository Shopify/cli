import {ThemeExtensionSchema} from './schemas.js'
import {ThemeExtension} from '../app/extensions.js'
import {id, path, schema, api, output, environment, string} from '@shopify/cli-kit'

// Base config type for a theme extension.
export type ThemeConfigContents = schema.define.infer<typeof ThemeExtensionSchema>

/**
 * Extension specification with all properties and methods needed to load a theme extension.
 */
const specification = {
  identifier: 'theme',
  externalIdentifier: 'theme_app_extension',
  partnersWebIdentifier: 'theme_app_extension',
  externalName: 'Theme app extension',
  graphQLType: 'theme_app_extension',
  schema: ThemeExtensionSchema,
}

/**
 * Class that represents an instance of a local theme extension
 * Before creating this class we've validated that
 * the config toml file for the theme extension follow the ThemeExtensionSchema
 *
 * This class holds the public interface to interact with theme extensions
 */
export class ThemeExtensionInstance<TConfiguration extends ThemeConfigContents = ThemeConfigContents>
  implements ThemeExtension<TConfiguration>
{
  outputBundlePath: string
  devUUID: string
  localIdentifier: string
  idEnvironmentVariableName: string
  directory: string
  configuration: TConfiguration
  configurationPath: string

  private remoteSpecification?: api.graphql.RemoteSpecification

  get graphQLType() {
    return specification.graphQLType.toUpperCase()
  }

  get identifier() {
    return specification.identifier
  }

  get type() {
    return specification.identifier
  }

  get humanName() {
    return this.remoteSpecification?.externalName ?? specification.externalName
  }

  get name() {
    return this.configuration.name
  }

  get externalType() {
    return this.remoteSpecification?.externalIdentifier ?? specification.externalIdentifier
  }

  constructor(options: {
    configuration: TConfiguration
    configurationPath: string
    directory: string
    remoteSpecification?: api.graphql.RemoteSpecification
  }) {
    this.configuration = options.configuration
    this.configurationPath = options.configurationPath
    this.directory = options.directory
    this.remoteSpecification = options.remoteSpecification
    this.outputBundlePath = path.join(options.directory, 'dist/main.js')
    this.devUUID = `dev-${id.generateRandomUUID()}`
    this.localIdentifier = path.basename(options.directory)
    this.idEnvironmentVariableName = `SHOPIFY_${string.constantize(path.basename(this.directory))}_ID`
  }

  async publishURL(options: {orgId: string; appId: string; extensionId?: string}) {
    const partnersFqdn = await environment.fqdn.partners()
    const parnersPath = specification.partnersWebIdentifier
    return `https://${partnersFqdn}/${options.orgId}/apps/${options.appId}/extensions/${parnersPath}/${options.extensionId}`
  }

  previewMessage() {
    const heading = output.token.heading(`${this.name} (${this.humanName})`)
    const link = output.token.link(
      'dev doc instructions',
      'https://shopify.dev/apps/online-store/theme-app-extensions/getting-started#step-3-test-your-changes',
    )
    const message = output.content`Follow the ${link} by deploying your work as a draft`

    return output.content`${heading}\n${message.value}\n`
  }
}

// PENDING: Fetch remote specs
function remoteSpecForType(type: string): api.graphql.RemoteSpecification | undefined {
  return undefined
}
