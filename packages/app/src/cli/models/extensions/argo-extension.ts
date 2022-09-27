/* eslint-disable line-comment-position */
import {FunctionExtensionConfiguration, FunctionExtensionMetadata, TypeSchema} from '../app/extensions.js'
import {loadLocalesConfig} from '../../utilities/extensions/locales-configuration.js'
import {parseFile} from '../app/parser.js'
import {DependencyVersion} from '@shopify/cli-kit/node/node-package-manager'
import {environment, error, file, id, output, path, schema, string} from '@shopify/cli-kit'
import {err, ok, Result} from '@shopify/cli-kit/common/result'

export interface ExtensionSpecification {
  name?: string
  externalName?: string
  identifier?: string
  externalIdentifier?: string
  surface?: string
  gated?: boolean
  registrationLimit?: number
}

export type ExtensionUIGroup = 'discounts_and_checkout' | 'analytics' | 'merchant_admin' | 'other'

export interface LocalSpecification {
  path: string
  entrySourceFilePath: string
  config: unknown
}

const MetafieldSchema = schema.define.object({
  namespace: schema.define.string(),
  key: schema.define.string(),
})

// No need for abstract class since all functions are generic enough to not need subclassing
export class BaseFunction {
  configuration: FunctionExtensionConfiguration
  metadata: FunctionExtensionMetadata
  directory: string

  constructor(options: {
    directory: string
    configuration: FunctionExtensionConfiguration
    metadata: FunctionExtensionMetadata
  }) {
    this.directory = options.directory
    this.configuration = options.configuration
    this.metadata = options.metadata
  }

  // buildWasmPath() {
  //   return this.configuration.build.path
  //     ? path.join(this.directory, this.configuration.build.path)
  //     : path.join(this.directory, 'dist/index.wasm')
  // }

  inputQueryPath() {
    return path.join(this.directory, 'input.graphql')
  }

  build() {
    // build function
  }

  validate() {
    // validate function
  }
}

const ArgoExtensionSchema = schema.define.object({
  name: schema.define.string(),
  type: schema.define.string(),
  metafields: schema.define.array(MetafieldSchema).default([]),
  extensionPoints: schema.define.array(schema.define.string()).optional(),
  capabilities: schema.define.any().optional(),
})

abstract class ArgoExtension {
  // Must be equal to the `identifier` from Remote Specifications
  abstract type: string

  // Properties from remote specification
  name: string
  externalName: string
  gated: boolean
  externalIdentifier: string
  surface?: string

  // Local properties handled by the CLI
  uiGroup: ExtensionUIGroup // Grouped by this value when shown in the extension select prompt UI
  devUUID: string // UUID used for dev
  rendererDependency: DependencyVersion // npm dependency for this extension
  abstract configuration: unknown // toml configuration loaded using the schema

  // Path related properties, these are generated from the initial `path` in the constructor
  directory: string // Directory where the extension is located
  localIdentifier: string // Basename of current directory used as identifier
  configurationPath: string // Path for the toml configuration file
  entrySourceFilePath: string // relative path to the entry file, of type `src/index.ts`
  outputBundlePath: string // path to the output bundle, of type `dist/main.js`

  constructor(options: {path: string; config: unknown; specification: ExtensionSpecification}) {
    this.directory = path.dirname(options.path)
    this.idEnvironmentVariableName = `SHOPIFY_${string.constantize(path.basename(this.directory))}_ID`
    this.localIdentifier = path.basename(this.directory)
    // this.configuration = options.config
    this.configurationPath = options.path

    this.entrySourceFilePath = '' // options.entrySourceFilePath
    this.outputBundlePath = path.join(this.directory, 'dist/main.js')

    this.name = options.specification.name
    this.externalName = options.specification.externalName
    this.identifier = options.specification.identifier
    this.externalIdentifier = options.specification.externalIdentifier
    this.gated = options.specification.gated
    this.registrationLimit = options.specification.registrationLimit
    this.surface = options.specification.surface
    this.devUUID = `dev-${id.generateRandomUUID()}`
    this.rendererDependency = {name: 'unknown-extension', version: '0.0.0'}
    this.uiGroup = 'other'
  }

  // Example of generic method abstracted in main class
  public async publishURL(orgId: string, appId: string, extensionId: string): Promise<string> {
    const partnersFqdn = await environment.fqdn.partners()
    return `https://${partnersFqdn}/${orgId}/apps/${appId}/extensions/${this.type}/${extensionId}`
  }

  // If the extension is not valid, return error
  public abstract validate(): Promise<Result<unknown, Error>>

  // Config values needed to start the dev server
  public abstract devConfig(): unknown

  // default build implementation
  public build() {}

  // Other generic methods
}

const CheckoutUISchema = ArgoExtensionSchema.extend({
  settings: schema.define.any().optional(),
})

export class CheckoutUIExtensionSpecification extends ArgoExtension {
  type = 'checkout_ui_extension'
  uiGroup: ExtensionUIGroup = 'discounts_and_checkout'
  rendererDependency: DependencyVersion = {name: '@shopify/checkout-ui-extensions-react', version: 'latest'}

  // If you need a custom schema you need to override the `configuration` variable and the constructor
  // Is there a better way to do this?
  configuration: schema.define.infer<typeof CheckoutUISchema>
  constructor(options: {path: string; config: schema.define.infer<typeof CheckoutUISchema>; specification: ExtensionSpecification}) {
    super(options)
    this.configuration = options.config
  }

  public async validate(): Promise<Result<unknown, Error>> {
    return ok({})
  }

  public async devConfig() {
    return {
      extension_points: this.configuration.extensionPoints,
      capabilities: this.configuration.capabilities,
      metafields: this.configuration.metafields,
      name: this.configuration.name,
      settings: this.configuration.settings,
      localization: await this.loadLocalesConfig(),
    }
  }

  private async loadLocalesConfig() {
    // Load the locales, this is specific for checkout ui extensions
  }
}

const ThemeAppExtSchema = schema.define.object({
  name: schema.define.string(),
  type: schema.define.enum(['theme']),
})

export class ThemeAppExtensionSpecification extends ArgoExtension {
  type = 'theme_app_extension'
  uiGroup: ExtensionUIGroup = 'other'

  configuration: schema.define.infer<typeof ThemeAppExtSchema>
  constructor(options: {path: string; config: schema.define.infer<typeof ThemeAppExtSchema>; specification: ExtensionSpecification}) {
    super(options)
    this.configuration = options.config
  }

  public async validate(): Promise<Result<unknown, Error>> {
    return ok({})
  }

  // Not needed for theme app extensions
  public async devConfig() { return {} }

  public async build() {
    // custom build of liquid files
  }

  public startDev() {
    // custom dev process
  }
}


const ClassMapping: {[key: string]: typeof ArgoExtension} = {
  checkout_ui_extension: CheckoutUIExtensionSpecification,
}

export async function extensionFactory<T>(configurationPath: string): Promise<T extends typeof ArgoExtension> {
  const result = await parseFile(TypeSchema, configurationPath)
  if (result.isErr()) throw new error.Abort('not handled yet')
  const type = result.value.type
  const ExtensionClass = ClassMapping[type]
  if (!ExtensionClass) throw new error.Abort('unkonwn extension type')
  const config = await parseFile(ExtensionClass.ConfigSchema, configurationPath)
  const directory = path.dirname(configurationPath)
  const entryPoint = await findEntrySourceFilePath(directory)
  if (config.isErr()) throw new error.Abort('not handled yet')
  if (entryPoint.isErr()) throw new error.Abort('not handled yet')
  const specification = {}
  const newClass = new CheckoutUIExtensionSpecification({
    path: configurationPath,
    config: config.value,
    specification,
  })
  return newClass
}

async function findEntrySourceFilePath(directory: string): Promise<Result<string, string>> {
  const entrySourceFilePath = (
    await Promise.all(
      ['index']
        .flatMap((name) => [`${name}.js`, `${name}.jsx`, `${name}.ts`, `${name}.tsx`])
        .flatMap((fileName) => [`src/${fileName}`, `${fileName}`])
        .map((relativePath) => path.join(directory, relativePath))
        .map(async (sourcePath) => ((await file.exists(sourcePath)) ? sourcePath : undefined)),
    )
  ).find((sourcePath) => sourcePath !== undefined)
  if (!entrySourceFilePath) return err('no entry source file found')
  return ok(entrySourceFilePath)
}
