import {ZodSchemaType, BaseConfigType} from './schemas.js'
import {ApplicationModule, ExtensionExperience, UidStrategy} from './application-module.js'
import {RemoteSpecification} from '../../api/graphql/extension_specifications.js'
import {ParseConfigurationResult} from '@shopify/cli-kit/node/schema'

/**
 * Pre-instantiation metadata for an application module type.
 *
 * This interface replaces ExtensionSpecification for concerns that must be
 * resolved BEFORE creating an ApplicationModule instance:
 * - Type identification (identifier lookup)
 * - Configuration schema and parsing
 * - App configuration schema contribution
 * - Instance creation (factory method)
 *
 * Unlike ExtensionSpecification, this interface has NO instance behavior.
 * All instance behavior lives on ApplicationModule subclasses.
 *
 * Each module type (function, ui_extension, theme, etc.) provides one
 * ModuleDescriptor that is registered in the ModuleRegistry.
 */
export interface ModuleDescriptor<TConfiguration extends BaseConfigType = BaseConfigType> {
  /** Primary type identifier (e.g., 'function', 'ui_extension', 'theme') */
  identifier: string

  /** Additional type strings this descriptor matches (e.g., function subtypes like 'order_discounts') */
  additionalIdentifiers: string[]

  /** External identifier used by the platform API */
  externalIdentifier: string

  /** Human-readable name for display */
  externalName: string

  /** Identifier used in Partners web UI */
  partnersWebIdentifier: string

  /** Surface where the module renders */
  surface: string

  /** Maximum number of instances allowed */
  registrationLimit: number

  /** Whether this is an extension or app configuration module */
  experience: ExtensionExperience

  /** Strategy for generating UIDs (overridden by remote spec) */
  uidStrategy: UidStrategy

  /** Zod schema for validating configuration */
  schema: ZodSchemaType<TConfiguration>

  /**
   * Have this descriptor contribute to the schema used to validate app configuration.
   * For descriptors that don't form part of app config, returns the schema unchanged.
   */
  contributeToAppConfigurationSchema: (appConfigSchema: ZodSchemaType<unknown>) => ZodSchemaType<unknown>

  /**
   * Parse a configuration object into a valid configuration for this module type.
   * Returns a success/error result with parsed data or validation errors.
   */
  parseConfigurationObject: (configurationObject: object) => ParseConfigurationResult<TConfiguration>

  /**
   * Factory: create the correct ApplicationModule subclass for this type.
   * The descriptor knows which class to instantiate and passes through
   * the construction options.
   */
  createModule: (options: {
    configuration: TConfiguration
    configurationPath: string
    entryPath?: string
    directory: string
    remoteSpec: RemoteSpecification
  }) => ApplicationModule<TConfiguration>
}
