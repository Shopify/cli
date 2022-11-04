import {functionExtensions, themeExtensions, uiExtensions, uiExternalExtensionTypes} from '../../constants.js'
import {schema} from '@shopify/cli-kit'

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
  capabilities: schema.define
    .object({
      block_progress: schema.define.boolean().optional(),
      network_access: schema.define.boolean().optional(),
    })
    .optional(),

  // Only for CheckoutUiExtension
  settings: schema.define.any().optional(),

  // Only for CustomerAccountsUiExtension
  categories: schema.define.array(schema.define.string()).optional(),
  localization: schema.define.any().optional(),

  // Only for WebPixel
  runtimeContext: schema.define.string().optional(),
  version: schema.define.string().optional(),
  configuration: schema.define.any().optional(),
})

export const UIExtensionConfigurationSupportedSchema = UIExtensionConfigurationSchema.extend({
  type: schema.define.enum([...uiExtensions.types, ...uiExternalExtensionTypes.types]),
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
