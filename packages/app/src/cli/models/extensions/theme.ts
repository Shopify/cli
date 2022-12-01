import {BaseThemeExtensionSchema, ZodSchemaType} from './schemas.js'
import {allThemeSpecifications} from './specifications.js'
import {ExtensionIdentifier, ThemeExtension} from '../app/extensions.js'
import {id, path, schema, api, output, environment, string} from '@shopify/cli-kit'

// Base config type that all config schemas must extend.
export type BaseThemeConfigContents = schema.define.infer<typeof BaseThemeExtensionSchema>

/**
 * Extension specification with all the needed properties and methods to load an extension.
 */
export interface ThemeExtensionSpec<TConfiguration extends BaseThemeConfigContents = BaseThemeConfigContents>
  extends ExtensionIdentifier {
  identifier: string
  externalIdentifier: string
  externalName: string
  partnersWebIdentifier: string
  graphQLType?: string
  schema: ZodSchemaType<TConfiguration>
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
export class ThemeExtensionInstance<TConfiguration extends BaseThemeConfigContents = BaseThemeConfigContents>
  implements ThemeExtension<TConfiguration>
{
  outputBundlePath: string
  devUUID: string
  localIdentifier: string
  idEnvironmentVariableName: string
  directory: string
  configuration: TConfiguration
  configurationPath: string

  private specification: ThemeExtensionSpec
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

  get externalType() {
    return this.remoteSpecification?.externalIdentifier ?? this.specification.externalIdentifier
  }

  constructor(options: {
    configuration: TConfiguration
    configurationPath: string
    directory: string
    specification: ThemeExtensionSpec
    remoteSpecification?: api.graphql.RemoteSpecification
  }) {
    this.configuration = options.configuration
    this.configurationPath = options.configurationPath
    this.directory = options.directory
    this.specification = options.specification
    this.remoteSpecification = options.remoteSpecification
    this.outputBundlePath = path.join(options.directory, 'dist/main.js')
    this.devUUID = `dev-${id.generateRandomUUID()}`
    this.localIdentifier = path.basename(options.directory)
    this.idEnvironmentVariableName = `SHOPIFY_${string.constantize(path.basename(this.directory))}_ID`
  }

  async publishURL(options: {orgId: string; appId: string; extensionId?: string}) {
    const partnersFqdn = await environment.fqdn.partners()
    const parnersPath = this.specification.partnersWebIdentifier
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

/**
 * Find the registered spececification for a given extension type
 */
export async function themeSpecForType(type: string): Promise<ThemeExtensionSpec | undefined> {
  const allSpecs = await allThemeSpecifications()
  return allSpecs.find((spec) => spec.identifier === type || spec.externalIdentifier === type)
}

// PENDING: Fetch remote specs
function remoteSpecForType(type: string): api.graphql.RemoteSpecification | undefined {
  return undefined
}

export function createThemeExtensionSpec<
  TConfiguration extends BaseThemeConfigContents = BaseThemeConfigContents,
>(spec: {
  identifier: string
  externalIdentifier: string
  partnersWebIdentifier: string
  externalName: string
  graphQLType?: string
  schema: ZodSchemaType<TConfiguration>
}): ThemeExtensionSpec<TConfiguration> {
  return spec
}
