import {schema} from '@shopify/cli-kit'

export const BundleUIExtensionSchema = schema.define.object({
  /** The extension UUID */
  id: schema.define.string(),
  /** The relative path to the Javascript bundle. */
  bundlePath: schema.define.string(),
})

export type BundleUIExtension = schema.define.infer<typeof BundleUIExtensionSchema>

export const BundleThemeExtensionSchema = schema.define.object({
  /** The extension UUID */
  id: schema.define.string(),
  /** A list of paths to the files that are part of the schema. */
  filePaths: schema.define.array(schema.define.string()),
})

export type BundleThemeExtension = schema.define.infer<typeof BundleThemeExtensionSchema>

export const BundleFunctionExtensionSchema = schema.define.object({
  /** The extension UUID */
  id: schema.define.string(),
  /** The path to the .wasm file of the function. */
  wasmPath: schema.define.string(),
})

export type BundleFunctionExtension = schema.define.infer<typeof BundleFunctionExtensionSchema>

export const BundleSchema = schema.define.object({
  /** The application API key */
  id: schema.define.string(),
  /** The collection of extensions that are part of the bundle */
  extensions: schema.define.object({
    /** UI extensions */
    ui: schema.define.array(BundleUIExtensionSchema),
    /** Theme extensions */
    theme: schema.define.array(BundleThemeExtensionSchema),
    /** Function extensions */
    function: schema.define.array(BundleFunctionExtensionSchema),
  }),
})

export type Bundle = schema.define.infer<typeof BundleSchema>
