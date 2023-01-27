import {schema} from '@shopify/cli-kit/node/schema'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ZodSchemaType<T> = schema.ZodType<T, any, any>

export const MetafieldSchema = schema.object({
  namespace: schema.string(),
  key: schema.string(),
})

export const CapabilitiesSchema = schema.object({
  network_access: schema.boolean().optional(),
  block_progress: schema.boolean().optional(),
  api_access: schema.boolean().optional(),
})

export const TypeSchema = schema.object({
  type: schema.string().default('ui_extension'),
})

export const NewExtensionPointSchema = schema.object({
  target: schema.string(),
  module: schema.string(),
  metafields: schema.array(MetafieldSchema).optional(),
})

export const OldExtensionPointsSchema = schema.array(schema.string()).default([])
export const NewExtensionPointsSchema = schema.array(NewExtensionPointSchema)
export const ExtensionPointSchema = schema.union([OldExtensionPointsSchema, NewExtensionPointsSchema])

export const BaseUIExtensionSchema = schema.object({
  name: schema.string(),
  description: schema.string().optional(),
  type: schema.string().default('ui_extension'),
  extensionPoints: schema.any().optional(),
  capabilities: CapabilitiesSchema.optional(),
  metafields: schema.array(MetafieldSchema).optional().default([]),
  categories: schema.array(schema.string()).optional(),
})

export const ThemeExtensionSchema = schema.object({
  name: schema.string(),
  type: schema.literal('theme'),
})

export const BaseFunctionConfigurationSchema = schema.object({
  name: schema.string(),
  type: schema.string(),
  description: schema.string().optional().default(''),
  build: schema.object({
    command: schema.string(),
    path: schema.string().optional(),
  }),
  configurationUi: schema.boolean().optional().default(true),
  ui: schema
    .object({
      enable_create: schema.boolean().optional(),
      paths: schema
        .object({
          create: schema.string(),
          details: schema.string(),
        })
        .optional(),
    })
    .optional(),
  apiVersion: schema.string(),
  input: schema
    .object({
      variables: schema
        .object({
          namespace: schema.string(),
          key: schema.string(),
        })
        .optional(),
    })
    .optional(),
})

export type NewExtensionPointSchemaType = schema.infer<typeof NewExtensionPointSchema>

// Base config type that all config schemas must extend.
export type BaseConfigContents = schema.infer<typeof BaseUIExtensionSchema>
