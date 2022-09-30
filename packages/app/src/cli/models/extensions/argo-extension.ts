// /* eslint-disable line-comment-position */
// import {TypeSchema} from '../app/extensions.js'
// import {parseFile} from '../app/parser.js'
// import {DependencyVersion} from '@shopify/cli-kit/node/node-package-manager'
// import {environment, error, file, id, path, schema, string} from '@shopify/cli-kit'
// import {err, ok, Result} from '@shopify/cli-kit/common/result'

import {file, path} from '@shopify/cli-kit'
import {err, ok, Result} from '@shopify/cli-kit/common/result'

// export interface ExtensionSpecification {
//   name: string
//   externalName: string
//   identifier: string
//   externalIdentifier: string
//   surface?: string
//   gated: boolean
//   registrationLimit: number
// }

// const MetafieldSchema = schema.define.object({
//   namespace: schema.define.string(),
//   key: schema.define.string(),
// })

// const BaseExtensionSchema = schema.define.object({
//   name: schema.define.string(),
//   type: schema.define.string(),
//   metafields: schema.define.array(MetafieldSchema).default([]),
//   extensionPoints: schema.define.array(schema.define.string()).optional(),
//   capabilities: schema.define.any().optional(),
// })

// const CheckoutUISchema = BaseExtensionSchema.extend({
//   settings: schema.define.any().optional(),
// })

// const NewSchema = BaseExtensionSchema.extend({
//   settings: schema.define.any().optional(),
//   somethingNew: schema.define.any()
// })

// export interface LocalExtensionSpecification {
//   identifier: string
//   dependency: DependencyVersion
//   schema: typeof BaseExtensionSchema
// }

// const LocalCheckoutSpecification: LocalExtensionSpecification = {
//   identifier = "checkout_ui_extension",
//   dependency = {
//     name = "@shopify/checkout-ui-extensions",
//     version = "0.0.0",
//   },
//   schema = CheckoutUISchema
// }

// const LocalNewSpecification: LocalExtensionSpecification = {
//   identifier = "new_ui_extension",
//   dependency = {
//     name = "@shopify/new-ui-extensions",
//     version = "0.0.0",
//   },
//   schema = NewSchema
// }

// const allLocalSpecifications = [LocalCheckoutSpecification, LocalNewSpecification]

//

// export interface LocalSpecification {
//   path: string
//   entrySourceFilePath: string
//   config: unknown
// }

// interface BaseExtensionOptions {
//   path: string
//   config: schema.define.infer<typeof BaseExtensionSchema>
//   specification: ExtensionSpecification
// }

// abstract class BaseExtension {
//   // Must override these static properties
//   static type: string // Must be equal to the `identifier` from Remote Specifications
//   static schema = BaseExtensionSchema // This is the schema for the extension's configuration file
//   static uiGroup: ExtensionUIGroup = 'other' // Grouped by this value when shown in the extension select prompt UI. By default: `other`

//   rendererDependency?: DependencyVersion // npm dependency for this extension
//   configuration: schema.define.infer<typeof BaseExtensionSchema> // toml configuration loaded using the schema

//   // Properties from remote specification
//   // Subclasses shouldn't need to override these.
//   name: string
//   identifier: string
//   externalName: string
//   gated: boolean
//   externalIdentifier: string
//   surface?: string

//   // Path related properties, these are generated from the initial `path` in the constructor
//   // Subclasses shouldn't need to override these.
//   directory: string // Directory where the extension is located
//   localIdentifier: string // Generated from the extension directory
//   configurationPath: string // Path to the toml configuration file
//   entrySourceFilePath: string // Relative path to the entry file, of type `src/index.ts`
//   outputBundlePath: string // Path to the output bundle, of type `dist/main.js`

//   constructor(options: BaseExtensionOptions) {
//     this.directory = path.dirname(options.path)
//     this.idEnvironmentVariableName = `SHOPIFY_${string.constantize(path.basename(this.directory))}_ID`
//     this.localIdentifier = path.basename(this.directory)
//     this.configuration = options.config
//     this.configurationPath = options.path

//     this.entrySourceFilePath = '' // options.entrySourceFilePath
//     this.outputBundlePath = path.join(this.directory, 'dist/main.js')

//     this.name = options.specification.name
//     this.externalName = options.specification.externalName
//     this.identifier = options.specification.identifier
//     this.externalIdentifier = options.specification.externalIdentifier
//     this.gated = options.specification.gated
//     this.surface = options.specification.surface
//     this.devUUID = `dev-${id.generateRandomUUID()}`
//     this.rendererDependency = undefined
//   }

//   // Example of generic method in base class
//   public async publishURL(orgId: string, appId: string, extensionId: string): Promise<string> {
//     const partnersFqdn = await environment.fqdn.partners()
//     return `https://${partnersFqdn}/${orgId}/apps/${appId}/extensions/${this.type}/${extensionId}`
//   }

//   // If the extension is not valid, return error, all extensions should implement this.
//   public abstract validate(): Promise<Result<unknown, Error>>

//   // Config values needed to start the dev server
//   public devConfig(): unknown {
//     return {}
//   }

//   // default build implementation
//   public build() {}

//   // An extension might want to customize the dev process
//   public dev() {}

//   // Other generic methods
// }

// export class CheckoutUIExtension extends BaseExtension {
//   // Mandatory overrides
//   static type = 'checkout_ui_extension'
//   static schema = CheckoutUISchema
//   static uiGroup: ExtensionUIGroup = 'discounts_and_checkout'
//   rendererDependency: DependencyVersion = {name: '@shopify/checkout-ui-extensions-react', version: 'latest'}

//   // If you need a custom schema you need to override the `configuration` variable and the constructor
//   configuration: schema.define.infer<typeof CheckoutUISchema>
//   constructor(options: {
//     path: string
//     config: schema.define.infer<typeof CheckoutUISchema>
//     specification: ExtensionSpecification
//   }) {
//     super(options)
//     this.configuration = options.config
//   }

//   public async validate(): Promise<Result<unknown, Error>> {
//     // Validate that all the required fields are present, all locales are valid, etc...
//     return ok({})
//   }

//   public async devConfig() {
//     return {
//       extension_points: this.configuration.extensionPoints,
//       capabilities: this.configuration.capabilities,
//       metafields: this.configuration.metafields,
//       name: this.configuration.name,
//       settings: this.configuration.settings,
//       localization: await this.loadLocalesConfig(),
//     }
//   }

//   private async loadLocalesConfig() {
//     // Load locales, this is specific for checkout ui extensions
//   }
// }

// const ThemeAppExtSchema = schema.define.object({
//   name: schema.define.string(),
//   type: schema.define.enum(['theme']),
// })

// export class ThemeAppExtensionSpecification extends BaseExtension {
//   type = 'theme_app_extension'
//   uiGroup: ExtensionUIGroup = 'other'
//   rendererDependency = undefined

//   public async validate(): Promise<Result<unknown, Error>> {
//     // Validate liquid files
//     console.log(this.configuration)
//     return ok({})
//   }

//   public async build() {
//     // custom build of liquid files
//   }

//   public dev() {
//     // custom dev process
//   }
// }

// export class NewExtension extends BaseExtension {
//   type = 'new_extension'
//   rendererDependency: DependencyVersion = {name: 'new-extension', version: '1.0.0'}

//   public async validate(): Promise<Result<unknown, Error>> {
//     return ok({})
//   }
// }

// // List of all available local specifications
// const extensionClasses = [CheckoutUIExtension, NewExtension]

// export async function extensionFactory(
//   configurationPath: string,
//   specifications: ExtensionSpecification[],
// ): Promise<Result<BaseExtension, string>> {
//   // Read type from config file
//   const result = await parseFile(TypeSchema, configurationPath)
//   if (result.isErr()) return err('error_reading_extension_type')
//   const type = result.value.type

//   // Get extension class from type
//   const ExtensionClass = extensionClasses.find((extClass) => extClass.type === type)
//   if (!ExtensionClass) return err('local_specification_not_found')

//   // Get extension specification
//   const specification = specifications.find((spec) => spec.identifier === type)
//   if (!specification) return err('remote_specification_not_found')

//   // Read the config file for the extension
//   const config = await parseFile(ExtensionClass.schema, configurationPath)

//   // Find the entry point for the extension (async operation)
//   const directory = path.dirname(configurationPath)
//   const entryPoint = await findEntrySourceFilePath(directory)
//   if (config.isErr()) return err('error_loading_config_file')
//   if (entryPoint.isErr()) return err('entry_point_not_found')

//   // Create the extension
//   const newClass = new ExtensionClass({
//     path: configurationPath,
//     config: config.value,
//     specification,
//   })
//   return ok(newClass)
// }

export async function findEntrySourceFilePath(directory: string): Promise<Result<string, string>> {
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
