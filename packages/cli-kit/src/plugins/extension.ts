/* eslint-disable line-comment-position */
import {FanoutHookFunction} from '../plugins.js'
import {define} from '../schema.js'
import {Result, ok, err} from '../common/result.js'
import {DependencyVersion} from '../node/node-package-manager.js'
import {path} from '@shopify/cli-kit'
import {getArrayRejectingUndefined} from '@shopify/cli-kit/common/array'

export interface ExtensionPlugin {
  find_extensions: {
    options: {[key: string]: never}
    pluginReturns: {
      [pluginName: string]: {extensions: LocalExtensionSpecification[]}
    }
  }
}

export type FindExtensionsFunction = FanoutHookFunction<'find_extensions', ''>
export const defineExtensions = (input: {extensions: LocalExtensionSpecification[]}): FindExtensionsFunction => {
  return async () => input
}

export type ExtensionUIGroup = 'discounts_and_checkout' | 'analytics' | 'merchant_admin' | 'other'

export interface RemoteExtensionSpecification {
  name: string
  externalName: string
  identifier: string
  externalIdentifier: string
  surface?: string
  gated: boolean
  registrationLimit: number
}

export interface LocalExtensionSpecification {
  identifier: string
  dependency: DependencyVersion
  uiGroup: ExtensionUIGroup
  ownerTeam: string
  schema: define.ZodType
  factory: (params: BaseExtensionOptions<BaseType>) => BaseExtension<BaseType>
}

export type ExtensionSpecification<TFactory extends BaseFactory> = LocalExtensionSpecification &
  RemoteExtensionSpecification

/**
 *EXAMPLES
 */

const MetafieldSchema = define.object({
  namespace: define.string(),
  key: define.string(),
})

export const BaseExtensionSchema = define.object({
  name: define.string(),
  type: define.string(),
  metafields: define.array(MetafieldSchema).default([]),
  extensionPoints: define.array(define.string()).optional(),
  capabilities: define.any().optional(),
})

export const NewSchema = BaseExtensionSchema.extend({
  settings: define.any().optional(),
  somethingNew: define.any(),
})

export const CheckoutUISchema = BaseExtensionSchema.extend({
  settings: define.any().optional(),
})

export const RemoteCheckoutSpecification: RemoteExtensionSpecification = {
  name: 'checkout',
  externalName: 'checkout external',
  identifier: 'checkout_id',
  externalIdentifier: 'checkout_ext_id',
  surface: 'checkout',
  gated: false,
  registrationLimit: 10,
}

export const LocalCheckoutSpecification: LocalExtensionSpecification = {
  identifier: 'checkout_ui_extension',
  dependency: {
    name: '@shopify/checkout-ui-extensions',
    version: '0.0.0',
  },
  uiGroup: 'discounts_and_checkout',
  schema: CheckoutUISchema,
  factory: (params) => new CheckoutExtension(params),
  ownerTeam: 'checkout_team',
}

export const RemoteNewExtSpecification: RemoteExtensionSpecification = {
  name: 'newExt',
  externalName: 'new external',
  identifier: 'new_id',
  externalIdentifier: 'new_ext_id',
  surface: 'another',
  gated: true,
  registrationLimit: 10,
}

export const LocalNewSpecification: LocalExtensionSpecification = {
  identifier: 'new_ui_extension',
  dependency: {
    name: '@shopify/new-ui-extensions',
    version: '0.0.0',
  },
  uiGroup: 'other',
  factory: new CheckoutUIExtensionFactory(),
  ownerTeam: 'checkout_team',
}

const merge = (
  local: LocalExtensionSpecification[],
  remote: RemoteExtensionSpecification[],
): ExtensionSpecification<BaseFactory>[] => {
  const result = local.map((localSpec) => {
    const remoteSpec = remote.find((spec) => spec.identifier === localSpec.identifier)
    if (!remoteSpec) return undefined
    return {...localSpec, ...remoteSpec}
  })
  return getArrayRejectingUndefined(result)
}

// Fetched from API, we don't know the possible types of extensions
const allRemote: RemoteExtensionSpecification[] = []

// Hardcoded in CLI, these are the ones that the CLI supports
const allLocalSpecifications = [LocalCheckoutSpecification, LocalNewSpecification]

// Merged specifications using the extension identifier
// If a local specification doesn't have a remote specification, it will be filtered out
export const fullSpecs = merge(allLocalSpecifications, allRemote)

export type BaseType = define.infer<typeof BaseExtensionSchema>

export interface BaseExtensionOptions<T extends BaseType> {
  configPath: string
  entryPoint: string
  config: T
  specification: ExtensionSpecification<BaseFactory>
}

export abstract class BaseExtension<T extends BaseType> {
  abstract type: string
  configuration: T // toml configuration loaded using the schema
  specification: ExtensionSpecification<BaseFactory>

  // Path related properties, these are generated from the initial `path` in the constructor
  // Subclasses shouldn't need to override these.
  directory: string // Directory where the extension is located
  localIdentifier: string // Generated from the extension directory
  configurationPath: string // Path to the toml configuration file
  entrySourceFilePath: string // Relative path to the entry file, of type `src/index.ts`
  outputBundlePath: string // Path to the output bundle, of type `dist/main.js`

  constructor(options: BaseExtensionOptions<T>) {
    // this.type = options.specification.identifier
    this.specification = options.specification
    this.directory = path.dirname(options.configPath)
    // this.idEnvironmentVariableName = `SHOPIFY_${string.constantize(path.basename(this.directory))}_ID`
    this.localIdentifier = path.basename(this.directory)
    this.configuration = options.config
    this.configurationPath = options.configPath

    this.entrySourceFilePath = '' // options.entrySourceFilePath
    this.outputBundlePath = path.join(this.directory, 'dist/main.js')
    // this.devUUID = `dev-${id.generateRandomUUID()}`
    // this.rendererDependency = undefined
  }

  public async validate(): Promise<Result<unknown, Error>> {
    return ok({})
  }

  public devConfig() {
    return {}
  }

  public abstract build(): Promise<void>

  public dev() {}
}

export abstract class BaseFactory {
  abstract schema: define.ZodType

  async build(
    configPath: string,
    spec: ExtensionSpecification<typeof this>,
  ): Promise<Result<BaseExtension<BaseType>, string>> {
    const config = await parseFile(this.schema, configPath)
    const entryPoint = await findEntrySourceFilePath(configPath)
    if (config.isErr()) return err(config.error.message)
    if (entryPoint.isErr()) return err(entryPoint.error)
    const params = {configPath, entryPoint: entryPoint.value, config: config.value, specification: spec}
    return ok(this.create(params))
  }

  abstract create(params: BaseExtensionOptions<BaseType>): BaseExtension<BaseType>
}

type CheckoutSchemaType = define.infer<typeof CheckoutUISchema>

export class CheckoutUIExtensionFactory extends BaseFactory {
  schema = CheckoutUISchema

  create(params: BaseExtensionOptions<CheckoutSchemaType>) {
    return new CheckoutExtension(params)
  }
}

export class CheckoutExtension extends BaseExtension<CheckoutSchemaType> {
  type = 'checkout_ui'

  public async devConfig() {
    return {
      extension_points: this.configuration.extensionPoints,
      capabilities: this.configuration.capabilities,
      metafields: this.configuration.metafields,
      name: this.configuration.name,
      settings: this.configuration.settings,
    }
  }

  build() {
    return Promise.resolve()
  }
}

class NewExtension extends BaseExtension<BaseType> {
  type = 'new_extension'

  build() {
    return Promise.resolve()
  }
}
