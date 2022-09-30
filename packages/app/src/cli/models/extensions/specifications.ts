import {buildExtension} from './proposal2.js'
import {DependencyVersion} from '@shopify/cli-kit/node/node-package-manager'
import {getArrayRejectingUndefined} from '@shopify/cli-kit/common/array'
import {schema} from '@shopify/cli-kit'
import {JsonMap} from '@shopify/cli-kit/src/json.js'

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

// type ExtensionFactoryFn<T extends BaseType> = (params: BaseExtensionOptions<T>) => BaseExtension<T>

export interface LocalExtensionSpecification<TSchema extends typeof BaseExtensionSchema = typeof BaseExtensionSchema> {
  identifier: string
  category: 'ui' | 'function'
  dependency: DependencyVersion
  uiGroup: ExtensionUIGroup
  ownerTeam: string
  schema: TSchema
  devConfig: (config: schema.define.infer<TSchema>) => JsonMap
}

interface UIExtensionSpec {
  identifier: string
  category: 'ui'

  // ... lots of things
}

type ExtensionSpec = UIExtensionSpec | FunctionExtensionSpec

function defineExtensionSpecs(specs: ExtensionSpec[]): ExtensionSpec[] {
  return specs
}

// type T = CheckoutExtension extends BaseExtension<infer T> ? true : never

export type ExtensionSpecification<TSchema extends typeof BaseExtensionSchema = typeof BaseExtensionSchema> =
  LocalExtensionSpecification<TSchema> & RemoteExtensionSpecification

/**
 *
 * EXAMPLES
 */

const MetafieldSchema = schema.define.object({
  namespace: schema.define.string(),
  key: schema.define.string(),
})

export const BaseExtensionSchema = schema.define.object({
  name: schema.define.string(),
  type: schema.define.string(),
  metafields: schema.define.array(MetafieldSchema).default([]),
  extensionPoints: schema.define.array(schema.define.string()).optional(),
  capabilities: schema.define.any().optional(),
})

export const NewSchema = BaseExtensionSchema.extend({
  settings: schema.define.any().optional(),
  somethingNew: schema.define.any(),
})

export const CheckoutUISchema = BaseExtensionSchema.extend({
  settings: schema.define.string(),
})

function defineExtensionSpec<TSchema extends typeof BaseExtensionSchema = typeof BaseExtensionSchema>(
  spec: LocalExtensionSpecification<TSchema>,
) {
  return spec.schema
}

export const LocalCheckoutSpecification: LocalExtensionSpecification<typeof CheckoutUISchema> = {
  identifier: 'checkout_ui_extension',
  category: 'ui',
  dependency: {
    name: '@shopify/checkout-ui-extensions',
    version: '0.0.0',
  },
  uiGroup: 'discounts_and_checkout',
  schema: CheckoutUISchema,
  ownerTeam: 'checkout_team',
  devConfig: (config) => {
    return {aa: config.type}
  },
}

export const RemoteCheckoutSpecification: RemoteExtensionSpecification = {
  name: 'checkout',
  externalName: 'checkout external',
  identifier: 'checkout_id',
  externalIdentifier: 'checkout_ext_id',
  surface: 'checkout',
  gated: false,
  registrationLimit: 10,
}

const CheckoutExtensionSpec = {
  ...RemoteCheckoutSpecification,
  ...LocalCheckoutSpecification,
}

async function load() {
  // const calu = await BaseExtension.build('asdasd', CheckoutExtensionSpec)
  const myExt = await buildExtension('asdasd', LocalCheckoutSpecification)
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
  category: 'ui',
  dependency: {
    name: '@shopify/new-ui-extensions',
    version: '0.0.0',
  },
  schema: BaseExtensionSchema,
  uiGroup: 'other',
  ownerTeam: 'checkout_team',
  devConfig: (config) => {
    return {settings: config.type}
  },
}

const NewExtensionSpec = {
  ...RemoteNewExtSpecification,
  ...LocalNewSpecification,
}

const extensions = [CheckoutExtensionSpec, NewExtensionSpec]

// function newExtensionFactory(params: BaseExtensionOptions<BaseType>) {
//   return new NewExtension(params)
// }

const merge = (
  local: LocalExtensionSpecification[],
  remote: RemoteExtensionSpecification[],
): ExtensionSpecification[] => {
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
