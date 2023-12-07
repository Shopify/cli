import {ZodSchemaType, BaseConfigType, BaseSchema} from './schemas.js'
import {ExtensionInstance} from './extension-instance.js'
import {blocks} from '../../constants.js'

import {Result, err, ok} from '@shopify/cli-kit/node/result'
import {capitalize} from '@shopify/cli-kit/common/string'
import {getPathValue, setPathValue} from '@shopify/cli-kit/common/object'
import {zod} from '@shopify/cli-kit/node/schema'

export type ExtensionFeature =
  | 'ui_preview'
  | 'function'
  | 'theme'
  | 'bundling'
  | 'cart_url'
  | 'esbuild'
  | 'single_js_entry_path'

export type ExtensionExperience = 'extension' | 'configuration'

interface ExtensionSpecificationCommon {
  identifier: string
  experience: ExtensionExperience
}

export interface TransformationConfig {
  schema: {[key: string]: string}
  types?: {[key: string]: {[key: string]: string}}
}

export interface CustomTransformationConfig {
  forward?: (obj: object) => object
  reverse?: (obj: object) => object
}

export interface ConfigExtensionSpecification<TConfiguration = unknown> extends ExtensionSpecificationCommon {
  schema: ZodSchemaType<TConfiguration>
  transformConfig?: TransformationConfig | CustomTransformationConfig
  validateConfig?: {[key: string]: unknown}

  validate: (obj: object) => Result<unknown, string>
  transform: (obj: object) => object
  reverseTransform: (obj: object) => object
}

/**
 * Extension specification with all the needed properties and methods to load an extension.
 */
export interface ExtensionSpecification<TConfiguration extends BaseConfigType = BaseConfigType>
  extends ExtensionSpecificationCommon {
  externalIdentifier: string
  externalName: string
  group?: string
  additionalIdentifiers: string[]
  partnersWebIdentifier: string
  surface: string
  registrationLimit: number
  dependency?: string
  graphQLType?: string
  schema: ZodSchemaType<TConfiguration>
  getBundleExtensionStdinContent?: (config: TConfiguration) => string
  deployConfig?: (
    config: TConfiguration,
    directory: string,
    apiKey: string,
    moduleId?: string,
  ) => Promise<{[key: string]: unknown} | undefined>
  validate?: (config: TConfiguration & {path: string}, directory: string) => Promise<Result<unknown, string>>
  preDeployValidation?: (extension: ExtensionInstance<TConfiguration>) => Promise<void>
  buildValidation?: (extension: ExtensionInstance<TConfiguration>) => Promise<void>
  hasExtensionPointTarget?(config: TConfiguration, target: string): boolean
  appModuleFeatures: (config?: TConfiguration) => ExtensionFeature[]
}

/**
 * These fields are forbidden when creating a new ExtensionSpec
 * They belong to the ExtensionSpec interface, but the values are obtained from the API
 * and should not be set by us locally
 */
export type ForbiddenFields =
  | 'registrationLimit'
  | 'category'
  | 'externalIdentifier'
  | 'externalName'
  | 'name'
  | 'surface'

/**
 * Partial ExtensionSpec type used when creating a new ExtensionSpec, the only mandatory field is the identifier
 */
export interface CreateExtensionSpecType<TConfiguration extends BaseConfigType = BaseConfigType>
  extends Partial<Omit<ExtensionSpecification<TConfiguration>, ForbiddenFields>> {
  identifier: string
  appModuleFeatures: (config?: TConfiguration) => ExtensionFeature[]
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
 * dependency?: {name: string; version: string} // dependency to be added to the extension's package.json
 * graphQLType?: string // GraphQL type of the extension (default: same as "identifier")
 * schema?: ZodSchemaType<TConfiguration> // schema used to validate the extension's configuration (default: BaseUIExtensionSchema)
 * getBundleExtensionStdinContent?: (configuration: TConfiguration) => string // function to generate the content of the stdin file used to bundle the extension
 * validate?: (configuration: TConfiguration, directory: string) => Promise<Result<undefined, Error>> // function to validate the extension's configuration
 * preDeployValidation?: (configuration: TConfiguration) => Promise<void> // function to validate the extension's configuration before deploying it
 * deployConfig?: (configuration: TConfiguration, directory: string) => Promise<{[key: string]: unknown}> // function to generate the extensions configuration payload to be deployed
 * hasExtensionPointTarget?: (configuration: TConfiguration, target: string) => boolean // function to determine if the extension has a given extension point target
 * ```
 */
export function createExtensionSpecification<TConfiguration extends BaseConfigType = BaseConfigType>(
  spec: CreateExtensionSpecType<TConfiguration>,
): ExtensionSpecification<TConfiguration> {
  const defaults = {
    // these two fields are going to be overridden by the extension specification API response,
    // but we need them to have a default value for tests
    externalIdentifier: `${spec.identifier}_external`,
    additionalIdentifiers: [],
    externalName: capitalize(spec.identifier.replace(/_/g, ' ')),
    surface: 'test-surface',
    partnersWebIdentifier: spec.identifier,
    schema: BaseSchema as ZodSchemaType<TConfiguration>,
    registrationLimit: blocks.extensions.defaultRegistrationLimit,
    experience: 'extension' as ExtensionExperience,
  }
  return {...defaults, ...spec}
}

export function createConfigExtensionSpecification<TConfiguration = unknown>(spec: {
  identifier: string
  schema: TConfiguration
  transformConfig?: TransformationConfig | CustomTransformationConfig
  validateConfig?: {[key: string]: unknown}
}): ConfigExtensionSpecification<TConfiguration> {
  return {
    identifier: spec.identifier,
    schema: spec.schema as ZodSchemaType<TConfiguration>,
    experience: 'configuration' as ExtensionExperience,
    transformConfig: spec.transformConfig,
    validateConfig: spec.validateConfig,
    validate: spec.validateConfig ? (object) => validate(object, spec.validateConfig!) : () => ok({} as unknown),
    transform: resolveTransformConfig(spec.transformConfig),
    reverseTransform: resolveReverseTransformConfig(spec.schema as ZodSchemaType<TConfiguration>, spec.transformConfig),
  }
}

function resolveTransformConfig(transformConfig?: TransformationConfig | CustomTransformationConfig) {
  if (!transformConfig) return (object: object) => defaultTransform(object as {[key: string]: unknown})

  if (Object.keys(transformConfig).includes('forward')) return (transformConfig as CustomTransformationConfig).forward!

  return (object: object) => transform(object, transformConfig as TransformationConfig)
}

function resolveReverseTransformConfig<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: zod.ZodType<T, any, any>,
  transformConfig?: TransformationConfig | CustomTransformationConfig,
) {
  if (!transformConfig) return (object: object) => defaultReverseTransform(schema, object)

  if (Object.keys(transformConfig).includes('reverse')) return (transformConfig as CustomTransformationConfig).reverse!

  return (object: object) => reverseTransform(object, transformConfig as TransformationConfig)
}

function validate(obj: object, config: {[key: string]: unknown}) {
  for (const [objectPath, validation] of Object.entries(config)) {
    const value = getPathValue(obj, objectPath)
    if (typeof value !== 'string' && !Array.isArray(value)) continue

    let values: string[] = []
    if (typeof value === 'string') {
      values.push(value)
    } else {
      values = value
    }

    const result = values.map((value) => {
      switch (validation) {
        case 'url':
          if (!validateUrl(value)) {
            return err(`${objectPath}. Invalid url: ${value}`)
          }
          break
        default:
          break
      }
      return ok({} as unknown)
    })
    const error = result.find((validation) => validation.isErr())
    if (error) return error
  }

  return ok({} as unknown)
}

function reverseTransform(obj: object, config: TransformationConfig) {
  return transform(obj, config, true)
}

function transform(obj: object, config: TransformationConfig, reverse = false): object {
  const transformedObj = {}

  for (const [mappedPath, objectPath] of Object.entries(config.schema)) {
    const originPath = reverse ? mappedPath : objectPath
    const targetPath = reverse ? objectPath : mappedPath
    let value = getPathValue(obj, originPath)

    if (reverse) {
      const typesConfig = getPathValue(config, `types.${targetPath}`) ?? {}
      for (const [originValue, targetValue] of Object.entries(typesConfig)) {
        if (value === targetValue) {
          value = parseValue(originValue)
          break
        }
      }
    } else {
      const transformation = getPathValue(config, `types.${originPath}.${value}`)
      if (transformation) {
        value = transformation
      }
    }

    if (value === undefined) continue
    setPathValue(transformedObj, targetPath, value)
  }

  return transformedObj
}

const validateUrl = (url: string) => {
  return /^https:\/\/.*/.test(url)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseValue(value: string): any {
  if (value === 'true') return true
  if (value === 'false') return false

  const num = Number(value)
  if (!isNaN(num)) return num

  return value
}

function defaultTransform(content: {[key: string]: unknown}): {[key: string]: unknown} {
  const firstKey = Object.keys(content)[0]
  return (firstKey ? content[firstKey] : content) as {[key: string]: unknown}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function defaultReverseTransform<T>(schema: zod.ZodType<T, any, any>, content: object) {
  const configSection: {[key: string]: unknown} = {}
  const firstLevelObjectName = Object.keys(schema._def.shape())[0]!
  configSection[firstLevelObjectName] = content
  return configSection
}
