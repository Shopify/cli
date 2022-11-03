import {BaseExtensionSchema, TypeSchema, ExtensionPointSchema} from './schemas'
import {ExtensionPointSpec} from './extension-points.js'
import {AppInterface} from '../app/app.js'
import {bundleExtension} from '../../services/extensions/bundle.js'
import {id, path, schema, toml, api, file} from '@shopify/cli-kit'
import {err, ok, Result} from '@shopify/cli-kit/common/result'
import {Writable} from 'node:stream'

// Base config type that all config schemas must extend.
type BaseConfigContents = schema.define.infer<typeof BaseExtensionSchema>
type ExtensionPointContents = schema.define.infer<typeof ExtensionPointSchema>

// Array with all registered extensions (locally)
// PENDING: Register and load all extensions
const AllLocalSpecs: ExtensionSpec[] = []

type LoadExtensionError = 'invalid_entry_path' | 'invalid_config' | 'invalid_extension_type'

/**
 * Extension specification with all the needed properties and methods to load an extension.
 */
export interface ExtensionSpec<TConfiguration extends BaseConfigContents = BaseConfigContents> {
  identifier: string
  ownerTeam: string
  dependency: {name: string; version: string}
  partnersWebId: string
  templatePath?: string
  schema: schema.define.ZodType<TConfiguration>
  deployConfig: (config: TConfiguration) => {[key: string]: unknown}
  preDeployValidation?: (config: TConfiguration) => boolean
  resourceUrl?: (config: TConfiguration) => string
  previewMessage?: (host: string, uuid: string, config: TConfiguration) => string
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
export class ExtensionInstance<TConfiguration extends BaseConfigContents = BaseConfigContents> {
  entryPath: string
  outputPath: string
  devUUID: string
  localIdentifier: string

  private config: TConfiguration
  private specification: ExtensionSpec
  private extensionPointSpecs?: ExtensionPointSpec[]
  private remoteSpecification?: api.graphql.RemoteSpecification
  private directory: string

  get type() {
    return this.specification.identifier
  }

  get humanName() {
    return this.remoteSpecification?.externalName
  }

  constructor(
    config: TConfiguration,
    entryPath: string,
    directory: string,
    specification: ExtensionSpec,
    remoteSpecification?: api.graphql.RemoteSpecification,
    extensionPointSpecs?: ExtensionPointSpec[],
  ) {
    this.config = config
    this.entryPath = entryPath
    this.directory = directory
    this.specification = specification
    this.remoteSpecification = remoteSpecification
    this.extensionPointSpecs = extensionPointSpecs
    this.outputPath = `${this.directory}/dist/main.js`
    this.devUUID = `dev-${id.generateRandomUUID()}`
    this.localIdentifier = path.basename(directory)
  }

  async build(stderr: Writable, stdout: Writable, app: AppInterface) {
    await bundleExtension({
      minify: true,
      outputBundlePath: this.outputPath,
      sourceFilePath: this.entryPath,
      environment: 'production',
      env: app.dotenv?.variables ?? {},
      stderr,
      stdout,
    })
    stdout.write(`${this.localIdentifier} successfully built`)
  }

  deployConfig() {
    return this.specification.deployConfig(this.config)
  }

  validate() {
    if (!this.specification.preDeployValidation) return true
    return this.specification.preDeployValidation(this.config)
  }

  resourceUrl() {
    if (this.extensionPointSpecs) {
      const urls = this.extensionPointSpecs.map((point) => {
        const conf = this.config.extension_points?.find((spec) => spec.type === point.type)
        if (!conf) return {type: point.type, url: undefined}
        return {type: point.type, url: this.extensionPointURL(point, conf)}
      })
      return urls
    } else {
      if (this.specification.resourceUrl) return this.specification.resourceUrl(this.config)
      return ''
    }
  }

  publishURL(options: {orgId: string; appId: string; extensionId: string}) {
    const partnersFqdn = 'partners.shopify.com'
    const parnersPath = this.specification.partnersWebId
    return `https://${partnersFqdn}/${options.orgId}/apps/${options.appId}/extensions/${parnersPath}/${options.extensionId}`
  }

  private extensionPointURL(point: ExtensionPointSpec, config: ExtensionPointContents): string {
    if (point.resourceUrl) return point.resourceUrl(config)
    return ''
  }
}

/**
 * Find the registered spececification for a given extension type
 */
function specForType(type: string): ExtensionSpec | undefined {
  return AllLocalSpecs.find((spec) => spec.identifier === type)
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
  const localSpec = specForType(type)
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
  const instance = new ExtensionInstance(config, entryPath[0], directory, localSpec, remoteSpec, [])
  return ok(instance)
}
