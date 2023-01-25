import {schema} from '@shopify/cli-kit/node/schema'

export const BundleUIExtensionSchema = schema.object({
  /** The extension UUID */
  id: schema.string(),
  /** The relative path to the Javascript bundle. */
  bundlePath: schema.string(),
})

export type BundleUIExtension = schema.infer<typeof BundleUIExtensionSchema>

export const BundleThemeExtensionSchema = schema.object({
  /** The extension UUID */
  id: schema.string(),
  /** A list of paths to the files that are part of the schema. */
  filePaths: schema.array(schema.string()),
})

export type BundleThemeExtension = schema.infer<typeof BundleThemeExtensionSchema>

export const BundleFunctionExtensionSchema = schema.object({
  /** The extension UUID */
  id: schema.string(),
  /** The path to the .wasm file of the function. */
  wasmPath: schema.string(),
})

export type BundleFunctionExtension = schema.infer<typeof BundleFunctionExtensionSchema>

export const BundleSchema = schema.object({
  /** The application API key */
  id: schema.string(),
  /** The collection of extensions that are part of the bundle */
  extensions: schema.object({
    /** UI extensions */
    ui: schema.array(BundleUIExtensionSchema),
    /** Theme extensions */
    theme: schema.array(BundleThemeExtensionSchema),
    /** Function extensions */
    function: schema.array(BundleFunctionExtensionSchema),
  }),
})

export type Bundle = schema.infer<typeof BundleSchema>
