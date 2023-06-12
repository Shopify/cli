import {ZodSchemaType, BaseConfigType, BaseSchema} from './schemas.js'
import {ExtensionInstance} from './extension-instance.js'
import {blocks, defaultExtensionFlavors} from '../../constants.js'

import {ExtensionFlavor} from '../app/template.js'
import {Result} from '@shopify/cli-kit/node/result'
import {capitalize} from '@shopify/cli-kit/common/string'
import {TokenizedString} from '@shopify/cli-kit/node/output'

export type ExtensionFeature = 'ui_preview' | 'function' | 'theme' | 'bundling' | 'cart_url' | 'esbuild'

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
  singleEntryPath: boolean
  registrationLimit: number
  supportedFlavors: ExtensionFlavor[]
  gated: boolean
  helpURL?: string
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
  validate?: (config: TConfiguration, directory: string) => Promise<Result<unknown, string>>
  preDeployValidation?: (extension: ExtensionInstance<TConfiguration>) => Promise<void>
  buildValidation?: (extension: ExtensionInstance<TConfiguration>) => Promise<void>
  previewMessage?: (
    host: string,
    uuid: string,
    config: TConfiguration,
    storeFqdn: string,
  ) => TokenizedString | undefined
  shouldFetchCartUrl?(config: TConfiguration): boolean
  hasExtensionPointTarget?(config: TConfiguration, target: string): boolean
  appModuleFeatures: (config: TConfiguration) => ExtensionFeature[]
}

/**
 * These fields are forbidden when creating a new ExtensionSpec
 * They belong to the ExtensionSpec interface, but the values are obtained from the API
 * and should not be set by the user locally
 *
 * WARNING: 'surface' should be included here but is not yet compatible with the extension server
 */
export type ForbiddenFields = 'registrationLimit' | 'category' | 'externalIdentifier' | 'externalName' | 'name'

/**
 * Partial ExtensionSpec type used when creating a new ExtensionSpec, the only mandatory field is the identifier
 */
export interface CreateExtensionSpecType<TConfiguration extends BaseConfigType = BaseConfigType>
  extends Partial<Omit<ExtensionSpecification<TConfiguration>, ForbiddenFields>> {
  identifier: string
  appModuleFeatures: (config: TConfiguration) => ExtensionFeature[]
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
 * supportedFlavors: {name: string; value: string}[] // list of supported flavors (default: 'javascript', 'typescript', 'typescript-react', 'javascript-react')
 * helpURL?: string // url to the help page for the extension, shown after generating the extension
 * dependency?: {name: string; version: string} // dependency to be added to the extension's package.json
 * graphQLType?: string // GraphQL type of the extension (default: same as "identifier")
 * schema?: ZodSchemaType<TConfiguration> // schema used to validate the extension's configuration (default: BaseUIExtensionSchema)
 * getBundleExtensionStdinContent?: (configuration: TConfiguration) => string // function to generate the content of the stdin file used to bundle the extension
 * validate?: (configuration: TConfiguration, directory: string) => Promise<Result<undefined, Error>> // function to validate the extension's configuration
 * preDeployValidation?: (configuration: TConfiguration) => Promise<void> // function to validate the extension's configuration before deploying it
 * deployConfig?: (configuration: TConfiguration, directory: string) => Promise<{[key: string]: unknown}> // function to generate the extensions configuration payload to be deployed
 * previewMessage?: (url: string, devUUID: string, configuration: TConfiguration, storeFqdn: string) => string | undefined // function to generate the preview message shown to the user during `dev`
 * shouldFetchCartUrl?: (configuration: TConfiguration) => boolean // function to determine if the extension should fetch the cart url
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
    surface: 'unknown',
    partnersWebIdentifier: spec.identifier,
    singleEntryPath: true,
    gated: false,
    schema: BaseSchema as ZodSchemaType<TConfiguration>,
    registrationLimit: blocks.extensions.defaultRegistrationLimit,
    supportedFlavors: defaultExtensionFlavors,
  }
  return {...defaults, ...spec}
}
