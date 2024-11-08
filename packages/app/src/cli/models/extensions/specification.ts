/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {ZodSchemaType, BaseConfigType, BaseSchema} from './schemas.js'
import {ExtensionInstance} from './extension-instance.js'
import {blocks} from '../../constants.js'

import {Flag} from '../../utilities/developer-platform-client.js'
import {AppConfigurationWithoutPath} from '../app/app.js'
import {loadLocalesConfig} from '../../utilities/extensions/locales-configuration.js'
import {Result} from '@shopify/cli-kit/node/result'
import {capitalize} from '@shopify/cli-kit/common/string'
import {ParseConfigurationResult, zod} from '@shopify/cli-kit/node/schema'
import {getPathValue, setPathValue} from '@shopify/cli-kit/common/object'
import {JsonMapType} from '@shopify/cli-kit/node/toml'

export type ExtensionFeature =
  | 'ui_preview'
  | 'function'
  | 'theme'
  | 'bundling'
  | 'cart_url'
  | 'esbuild'
  | 'single_js_entry_path'
  | 'localization'
  | 'generates_source_maps'

export interface TransformationConfig {
  [key: string]: string
}

export interface CustomTransformationConfig {
  forward?: (obj: object, appConfiguration: AppConfigurationWithoutPath, options?: {flags?: Flag[]}) => object
  reverse?: (obj: object, options?: {flags?: Flag[]}) => object
}

type ExtensionExperience = 'extension' | 'configuration'
type UidStrategy = 'single' | 'dynamic' | 'uuid'

/**
 * Extension specification with all the needed properties and methods to load an extension.
 */
export interface ExtensionSpecification<TConfiguration extends BaseConfigType = BaseConfigType> {
  identifier: string
  externalIdentifier: string
  externalName: string
  group?: string
  additionalIdentifiers: string[]
  partnersWebIdentifier: string
  surface: string
  registrationLimit: number
  experience: ExtensionExperience
  dependency?: string
  graphQLType?: string
  getBundleExtensionStdinContent?: (config: TConfiguration) => string
  deployConfig?: (
    config: TConfiguration,
    directory: string,
    apiKey: string,
    moduleId?: string,
  ) => Promise<{[key: string]: unknown} | undefined>
  validate?: (config: TConfiguration, configPath: string, directory: string) => Promise<Result<unknown, string>>
  preDeployValidation?: (extension: ExtensionInstance<TConfiguration>) => Promise<void>
  buildValidation?: (extension: ExtensionInstance<TConfiguration>) => Promise<void>
  hasExtensionPointTarget?(config: TConfiguration, target: string): boolean
  appModuleFeatures: (config?: TConfiguration) => ExtensionFeature[]

  /**
   * If required, convert configuration from the format used in the local filesystem to that expected by the platform.
   *
   * @param localContent - Content taken from the local filesystem
   * @returns Transformed configuration to send to the platform in place of the locally provided content
   */
  transformLocalToRemote?: (localContent: object, appConfiguration: AppConfigurationWithoutPath) => object

  /**
   * If required, convert configuration from the platform to the format used locally in the filesystem.
   *
   * @param remoteContent - Platform provided content taken from an instance of this module
   * @param existingAppConfiguration - Existing app configuration on the filesystem that this transformed content may be merged with
   * @param options - Additional options to be used in the transformation
   * @returns Transformed configuration to use in place of the platform provided content
   */
  transformRemoteToLocal?: (remoteContent: object, options?: {flags?: Flag[]}) => object

  uidStrategy: UidStrategy

  /**
   * Have this specification contribute to the schema used to validate app configuration. For specifications that don't
   * form part of app config, they can return the schema unchanged.
   *
   * @param appConfigSchema - The schema used to validate app configuration. This will usually be the output from calling this function for another specification
   * @returns The schema used to validate app configuration, with this specification's schema merged in
   */
  contributeToAppConfigurationSchema: (appConfigSchema: ZodSchemaType<unknown>) => ZodSchemaType<unknown>

  /**
   * Parse some provided configuration into a valid configuration object for this extension.
   */
  parseConfigurationObject: (configurationObject: object) => ParseConfigurationResult<TConfiguration>
}

/**
 * Extension specification, explicitly marked as having taken remote configuration values into account.
 */
export type RemoteAwareExtensionSpecification<TConfiguration extends BaseConfigType = BaseConfigType> =
  ExtensionSpecification<TConfiguration> & {
    loadedRemoteSpecs: true
  }

/**
 * These fields are forbidden when creating a new ExtensionSpec
 * They belong to the ExtensionSpec interface, but the values are obtained from the API
 * and should not be set by us locally
 */
type ForbiddenFields =
  | 'registrationLimit'
  | 'category'
  | 'externalIdentifier'
  | 'externalName'
  | 'name'
  | 'surface'
  | 'contributeToAppConfigurationSchema'
  | 'parseConfigurationObject'

/**
 * Partial ExtensionSpec type used when creating a new ExtensionSpec, the only mandatory field is the identifier
 */
interface CreateExtensionSpecType<TConfiguration extends BaseConfigType = BaseConfigType>
  extends Partial<Omit<ExtensionSpecification<TConfiguration>, ForbiddenFields>> {
  identifier: string
  appModuleFeatures: (config?: TConfiguration) => ExtensionFeature[]
  schema?: ZodSchemaType<TConfiguration>
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
    transform: spec.transformLocalToRemote,
    reverseTransform: spec.transformRemoteToLocal,
    experience: spec.experience ?? 'extension',
    uidStrategy: spec.uidStrategy ?? (spec.experience === 'configuration' ? 'single' : 'uuid'),
  }
  const merged = {...defaults, ...spec}

  return {
    ...merged,
    contributeToAppConfigurationSchema: (appConfigSchema: ZodSchemaType<unknown>) => {
      if (merged.uidStrategy !== 'single') {
        // no change
        return appConfigSchema
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (appConfigSchema as any).merge(merged.schema)
    },
    parseConfigurationObject: (configurationObject: unknown) => {
      const parseResult = merged.schema.safeParse(configurationObject)
      if (!parseResult.success) {
        return {
          state: 'error',
          data: undefined,
          errors: parseResult.error.errors,
        }
      }
      return {
        state: 'ok',
        data: parseResult.data,
        errors: undefined,
      }
    },
  }
}

/**
 * Create a new app config extension spec. This factory method for creating app config extensions is created for two
 * reasons:
 *   - schema needs to be casted to ZodSchemaType<TConfiguration>
 *   - App config extensions have default transform and reverseTransform functions

 */
export function createConfigExtensionSpecification<TConfiguration extends BaseConfigType = BaseConfigType>(spec: {
  identifier: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: zod.ZodObject<any>
  appModuleFeatures?: (config?: TConfiguration) => ExtensionFeature[]
  transformConfig?: TransformationConfig | CustomTransformationConfig
  uidStrategy?: UidStrategy
}): ExtensionSpecification<TConfiguration> {
  const appModuleFeatures = spec.appModuleFeatures ?? (() => [])
  return createExtensionSpecification({
    identifier: spec.identifier,
    // This casting is required because `name` and `type` are mandatory for the existing extension spec configurations,
    // however, app config extensions config content is parsed from the `shopify.app.toml`
    schema: spec.schema as unknown as ZodSchemaType<TConfiguration>,
    appModuleFeatures,
    transformLocalToRemote: resolveAppConfigTransform(spec.transformConfig),
    transformRemoteToLocal: resolveReverseAppConfigTransform(spec.schema, spec.transformConfig),
    experience: 'configuration',
    uidStrategy: spec.uidStrategy ?? 'single',
  })
}

/**
 * Create a zod object schema based on keys, but neutral as to content.
 *
 * Used for schemas that are supplemented by JSON schema contracts, but need to register top-level keys.
 */
function neutralTopLevelSchema<TKey extends string>(...keys: TKey[]): zod.ZodObject<{[k in TKey]: zod.ZodAny}> {
  return zod.object(
    Object.fromEntries(
      keys.map((key) => {
        return [key, zod.any()]
      }),
    ),
  ) as zod.ZodObject<{[k in TKey]: zod.ZodAny}>
}

/**
 * Create a new app config extension spec that uses contract-based validation.
 *
 * See {@link createConfigExtensionSpecification} for more about app config extensions.
 */
export function createContractBasedConfigModuleSpecification<TKey extends string>(
  identifier: string,
  ...topLevelKeys: TKey[]
): ExtensionSpecification {
  const schema = neutralTopLevelSchema(...topLevelKeys)
  return createConfigExtensionSpecification({
    identifier,
    schema,
    transformConfig: {
      // outgoing config is already scoped to this module and passed directly along
      forward(obj) {
        return obj
      },
      // incoming config from the platform is included in app config as-is
      reverse(obj) {
        return obj
      },
    },
  })
}

export function createContractBasedModuleSpecification<TConfiguration extends BaseConfigType = BaseConfigType>(
  identifier: string,
  appModuleFeatures?: ExtensionFeature[],
) {
  return createExtensionSpecification({
    identifier,
    schema: zod.any({}) as unknown as ZodSchemaType<TConfiguration>,
    appModuleFeatures: () => appModuleFeatures ?? [],
    deployConfig: async (config, directory) => {
      let parsedConfig = configWithoutFirstClassFields(config)
      if (appModuleFeatures?.includes('localization')) {
        const localization = await loadLocalesConfig(directory, identifier)
        parsedConfig = {...parsedConfig, localization}
      }
      return parsedConfig
    },
  })
}

function resolveAppConfigTransform(transformConfig?: TransformationConfig | CustomTransformationConfig) {
  if (!transformConfig) return (content: object) => defaultAppConfigTransform(content as {[key: string]: unknown})

  if (Object.keys(transformConfig).includes('forward')) {
    return (transformConfig as CustomTransformationConfig).forward!
  } else {
    return (content: object) => appConfigTransform(content, transformConfig)
  }
}

function resolveReverseAppConfigTransform<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: zod.ZodType<T, any, any>,
  transformConfig?: TransformationConfig | CustomTransformationConfig,
) {
  if (!transformConfig)
    return (content: object) => defaultAppConfigReverseTransform(schema, content as {[key: string]: unknown})

  if (Object.keys(transformConfig).includes('reverse')) {
    return (transformConfig as CustomTransformationConfig).reverse!
  } else {
    return (content: object) => appConfigTransform(content, transformConfig, true)
  }
}

/**
 * Given an object:
 * ```json
 * { source: { fieldSourceA: 'valueA' } }
 * ```
 *  and a transform config content like this:
 * ```json
 * { 'target.fieldTargetA': 'source.fieldSourceA'}
 * ```
 * the method returns the following object:
 * ```json
 * { source: { fieldTargetA: 'valueA' } }
 * ```
 * The transformation can be applied in both ways depending on the reverse parameter
 *
 * @param content - The objet to be transformed
 * @param config - The transformation config
 * @param reverse - If true, the transformation will be applied in reverse
 *
 * @returns the transformed object
 */

function appConfigTransform(
  content: object,
  config: TransformationConfig | CustomTransformationConfig,
  reverse = false,
): object {
  const transformedContent = {}

  for (const [mappedPath, objectPath] of Object.entries(config)) {
    const originPath = reverse ? mappedPath : objectPath
    const targetPath = reverse ? objectPath : mappedPath
    const sourceValue = getPathValue(content, originPath)
    if (sourceValue !== undefined) setPathValue(transformedContent, targetPath, sourceValue)
  }

  return transformedContent
}

/**
 * Flat the configuration object to a single level object. This is the schema expected by the server side.
 * ```json
 * {
 *   pos: {
 *    embedded = true
 *   }
 * }
 * ```
 * will be flattened to:
 * ```json
 * {
 *  embedded = true
 * }
 * ```
 * @param content - The objet to be flattened
 *
 * @returns A single level object
 */
function defaultAppConfigTransform(content: {[key: string]: unknown}) {
  return Object.keys(content).reduce((result, key) => {
    const isObjectNotArray = content[key] !== null && typeof content[key] === 'object' && !Array.isArray(content[key])
    return {...result, ...(isObjectNotArray ? {...(content[key] as object)} : {[key]: content[key]})}
  }, {})
}

/**
 * Nest the content inside the first level objects expected by the local schema.
 * ```json
 * {
 *  embedded = true
 * }
 * ```
 * will be nested after applying the proper schema:
 * ```json
 * {
 *   pos: {
 *    embedded = true
 *   }
 * }
 * ```
 * @param content - The objet to be nested
 *
 * @returns The nested object
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function defaultAppConfigReverseTransform<T>(schema: zod.ZodType<T, any, any>, content: {[key: string]: unknown}) {
  return Object.keys(schema._def.shape()).reduce((result: {[key: string]: unknown}, key: string) => {
    let innerSchema = schema._def.shape()[key]
    if (innerSchema instanceof zod.ZodOptional) {
      innerSchema = innerSchema._def.innerType
    }
    if (innerSchema instanceof zod.ZodObject) {
      result[key] = defaultAppConfigReverseTransform(innerSchema, content)
    } else {
      if (content[key] !== undefined) result[key] = content[key]
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete content[key]
    }
    return result
  }, {})
}

/**
 * Remove the first class fields from the config.
 *
 * These are the fields that are not part of the specific extension contract, but are added automatically to all modules tomls.
 * So it must be cleaned before validation or deployment.
 * (this was initially done automatically by zod, but is not supported by JSON Schema & contracts)
 *
 * @param config - The config to remove the first class fields from
 *
 * @returns The config without the first class fields
 */
export function configWithoutFirstClassFields(config: JsonMapType): JsonMapType {
  const {type, handle, uid, path, extensions, ...configWithoutFirstClassFields} = config
  return configWithoutFirstClassFields
}
