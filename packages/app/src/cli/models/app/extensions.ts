import {
  functionExtensions,
  themeExtensions,
  uiExtensions,
  ExtensionTypes,
  uiExtensionTypeKeys,
} from '../../constants.js'
import {schema} from '@shopify/cli-kit'

export interface Extension {
  idEnvironmentVariableName: string
  localIdentifier: string
  configurationPath: string
  directory: string
  type: ExtensionTypes
  graphQLType: string
}

export const UIExtensionConfigurationSchema = schema.define.object({
  name: schema.define.string(),
  type: schema.define.enum(uiExtensions.types),
  metafields: schema.define
    .array(
      schema.define.object({
        namespace: schema.define.string(),
        key: schema.define.string(),
      }),
    )
    .default([]),
  extensionPoints: schema.define.array(schema.define.string()).optional(),
  capabilities: schema.define.any().optional(),

  // Only for CheckoutUiExtension
  configurationSchema: schema.define.any().optional(),

  // Only for WebPixel
  runtimeContext: schema.define.string().optional(),
  version: schema.define.string().optional(),
  configuration: schema.define.any().optional(),
})

export const UIExtensionConfigurationSupportedSchema = UIExtensionConfigurationSchema.extend({
  type: schema.define.enum([...uiExtensions.types, ...uiExtensionTypeKeys.types]),
})

export const FunctionExtensionConfigurationSchema = schema.define.object({
  name: schema.define.string(),
  type: schema.define.enum(functionExtensions.types),
  description: schema.define.string().default(''),
  build: schema.define.object({
    command: schema.define.string(),
    path: schema.define.string().optional(),
  }),
  configurationUi: schema.define.boolean().optional().default(true),
  ui: schema.define
    .object({
      paths: schema.define
        .object({
          create: schema.define.string(),
          details: schema.define.string(),
        })
        .optional(),
    })
    .optional(),
  apiVersion: schema.define.string(),
})

export const ThemeExtensionConfigurationSchema = schema.define.object({
  name: schema.define.string(),
  type: schema.define.enum(themeExtensions.types),
})

export const FunctionExtensionMetadataSchema = schema.define.object({
  schemaVersions: schema.define.object({}).catchall(
    schema.define.object({
      major: schema.define.number(),
      minor: schema.define.number(),
    }),
  ),
})

export type FunctionExtension = Extension & {
  configuration: FunctionExtensionConfiguration
  metadata: FunctionExtensionMetadata
  buildWasmPath: () => string
  inputQueryPath: () => string
}

export type ThemeExtension = Extension & {
  configuration: ThemeExtensionConfiguration
}

export type UIExtension = Extension & {
  configuration: UIExtensionConfiguration
  buildDirectory: string
  entrySourceFilePath: string
  devUUID: string
}

type UIExtensionConfiguration = schema.define.infer<typeof UIExtensionConfigurationSchema>
type FunctionExtensionConfiguration = schema.define.infer<typeof FunctionExtensionConfigurationSchema>
type ThemeExtensionConfiguration = schema.define.infer<typeof ThemeExtensionConfigurationSchema>
type FunctionExtensionMetadata = schema.define.infer<typeof FunctionExtensionMetadataSchema>
