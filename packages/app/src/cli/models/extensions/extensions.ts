import {BaseExtensionSchema, TypeSchema, ExtensionPointSchema} from './schemas.js'
import {ExtensionPointSpec} from './extension-points.js'
import {allExtensionSpecifications} from './specifications.js'
import {AppInterface} from '../app/app.js'
import {bundleExtension} from '../../services/extensions/bundle.js'
import {ThemeExtension, UIExtension} from '../app/extensions.js'
import {id, path, schema, toml, api, file, output, environment, string} from '@shopify/cli-kit'
import {err, ok, Result} from '@shopify/cli-kit/common/result'
import {Writable} from 'node:stream'

// Base config type that all config schemas must extend.
export type BaseConfigContents = schema.define.infer<typeof BaseExtensionSchema>
export type ExtensionPointContents = schema.define.infer<typeof ExtensionPointSchema>

type LoadExtensionError = 'invalid_entry_path' | 'invalid_config' | 'invalid_extension_type'

/**
 * Extension specification with all the needed properties and methods to load an extension.
 */
export interface ExtensionSpec<TConfiguration extends BaseConfigContents = BaseConfigContents> {
  identifier: string
  dependency?: {name: string; version: string}
  partnersWebId: string
  templatePath?: string
  graphQLType?: string
  schema: schema.define.ZodType<TConfiguration>
  deployConfig?: (config: TConfiguration, directory: string) => Promise<{[key: string]: unknown}>
  preDeployValidation?: (config: TConfiguration) => boolean
  resourceUrl?: (config: TConfiguration) => string
  previewMessage?: (
    host: string,
    uuid: string,
    config: TConfiguration,
    storeFqdn: string,
  ) => output.TokenizedString | undefined
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
export class ExtensionInstance<TConfiguration extends BaseConfigContents = BaseConfigContents>
  implements UIExtension<TConfiguration>, ThemeExtension<TConfiguration>
{
  entrySourceFilePath: string
  outputBundlePath: string
  devUUID: string
  localIdentifier: string
  idEnvironmentVariableName: string
  directory: string
  configuration: TConfiguration
  configurationPath: string

  private specification: ExtensionSpec
  private extensionPointSpecs?: ExtensionPointSpec[]
  private remoteSpecification?: api.graphql.RemoteSpecification

  get graphQLType() {
    return this.specification.graphQLType ?? this.specification.identifier
  }

  get identifier() {
    return this.specification.identifier
  }

  get type() {
    return this.specification.identifier
  }

  get humanName() {
    return this.remoteSpecification?.externalName ?? this.specification.identifier
  }

  get name() {
    return this.configuration.name
  }

  get dependency() {
    return this.specification.dependency
  }

  get externalType() {
    return this.remoteSpecification?.externalIdentifier ?? this.specification.identifier
  }

  constructor(
    configuration: TConfiguration,
    configuationPath: string,
    entryPath: string,
    directory: string,
    specification: ExtensionSpec,
    remoteSpecification?: api.graphql.RemoteSpecification,
    extensionPointSpecs?: ExtensionPointSpec[],
  ) {
    this.configuration = configuration
    this.configurationPath = configuationPath
    this.entrySourceFilePath = entryPath
    this.directory = directory
    this.specification = specification
    this.remoteSpecification = remoteSpecification
    this.extensionPointSpecs = extensionPointSpecs
    this.outputBundlePath = path.join(directory, 'dist/main.js')
    this.devUUID = `dev-${id.generateRandomUUID()}`
    this.localIdentifier = path.basename(directory)
    this.idEnvironmentVariableName = `SHOPIFY_${string.constantize(path.basename(this.directory))}_ID`
  }

  async build(stderr: Writable, stdout: Writable, app: AppInterface) {
    stdout.write(`Bundling UI extension ${this.localIdentifier}...`)
    await bundleExtension({
      minify: true,
      outputBundlePath: this.outputBundlePath,
      sourceFilePath: this.entrySourceFilePath,
      environment: 'production',
      env: app.dotenv?.variables ?? {},
      stderr,
      stdout,
    })
    stdout.write(`${this.localIdentifier} successfully built`)
  }

  async deployConfig(): Promise<{[key: string]: unknown}> {
    return this.specification.deployConfig?.(this.configuration, this.directory) ?? {}
  }

  validate() {
    if (!this.specification.preDeployValidation) return true
    return this.specification.preDeployValidation(this.configuration)
  }

  resourceUrl() {
    if (this.extensionPointSpecs) {
      // PENDING: Add support for externsion pints
      return ''
    } else {
      return this.specification.resourceUrl?.(this.configuration) ?? ''
    }
  }

  async publishURL(options: {orgId: string; appId: string; extensionId?: string}) {
    const partnersFqdn = await environment.fqdn.partners()
    const parnersPath = this.specification.partnersWebId
    return `https://${partnersFqdn}/${options.orgId}/apps/${options.appId}/extensions/${parnersPath}/${options.extensionId}`
  }

  previewMessage(url: string, storeFqdn: string) {
    if (this.specification.previewMessage)
      return this.specification.previewMessage(url, this.devUUID, this.configuration, storeFqdn)

    const heading = output.token.heading(`${this.name} (${this.humanName})`)
    const publicURL = `${url}/extensions/${this.devUUID}`
    const message = output.content`Preview link: ${publicURL}`
    return output.content`${heading}\n${message.value}\n`
  }

  private extensionPointURL(point: ExtensionPointSpec, config: ExtensionPointContents): string {
    return point.resourceUrl?.(config) ?? ''
  }
}

/**
 * Find the registered spececification for a given extension type
 */
export async function specForType(type: string): Promise<ExtensionSpec | undefined> {
  const allSpecs = await allExtensionSpecifications()
  return allSpecs.find((spec) => spec.identifier === type)
}

// PENDING: Fetch remote specs
function remoteSpecForType(type: string): api.graphql.RemoteSpecification | undefined {
  return undefined
}

/**
 * Load an extension from given a path.
 * 1. Find the entryPoint file
 * 2. Read the type and find the registered spec for that type.
 * 3. Parse the config file using the schema from the spec
 *
 * If that fails the extension can't be loaded and we'll return an error (to be handled by the caller)
 */
export async function loadExtension(configPath: string): Promise<Result<ExtensionInstance, LoadExtensionError>> {
  const directory = path.dirname(configPath)

  // Find entry paths
  const entryPath = await path.glob(path.join(directory, 'src', '*.+(ts|js|tsx|jsx)'))
  if (!entryPath[0]) return err('invalid_entry_path')

  // Read Config file
  const fileContent = await file.read(configPath)
  const obj = toml.decode(fileContent)
  const {type} = TypeSchema.parse(obj)

  // Find spec for this type
  const localSpec = await specForType(type)
  const remoteSpec = remoteSpecForType(type)

  if (!localSpec) return err('invalid_extension_type')

  // Parse config for this extension type schema
  let config
  try {
    config = localSpec.schema.parse(obj)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return err('invalid_config')
  }

  // PENDING: Add support for extension points and validate them
  const instance = new ExtensionInstance(config, configPath, entryPath[0], directory, localSpec, remoteSpec, [])
  return ok(instance)
}

export function createExtensionSpec<TConfiguration extends BaseConfigContents = BaseConfigContents>(
  spec: ExtensionSpec<TConfiguration>,
): ExtensionSpec<TConfiguration> {
  return spec
}
