import {schema} from '@shopify/cli-kit'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ZodSchemaType<T> = schema.define.ZodType<T, any, any>

export const MetafieldSchema = schema.define.object({
  namespace: schema.define.string(),
  key: schema.define.string(),
})

export const CapabilitiesSchema = schema.define.object({
  network_access: schema.define.boolean().optional(),
  block_progress: schema.define.boolean().optional(),
  api_access: schema.define.boolean().optional(),
})

export const TypeSchema = schema.define.object({
  type: schema.define.string().default('ui_extension'),
})

export const NewExtensionPointSchema = schema.define.object({
  target: schema.define.string(),
  module: schema.define.string(),
  metafields: schema.define.array(MetafieldSchema).optional(),
})

export const OldExtensionPointsSchema = schema.define.array(schema.define.string()).default([])
export const NewExtensionPointsSchema = schema.define.array(NewExtensionPointSchema)
export const ExtensionPointSchema = schema.define.union([OldExtensionPointsSchema, NewExtensionPointsSchema])

export const BaseUIExtensionSchema = schema.define.object({
  name: schema.define.string(),
  type: schema.define.string().default('ui_extension'),
  extensionPoints: schema.define.any().optional(),
  capabilities: CapabilitiesSchema.optional(),
  metafields: schema.define.array(MetafieldSchema).optional().default([]),
  categories: schema.define.array(schema.define.string()).optional(),
})

export const BaseThemeExtensionSchema = schema.define.object({
  name: schema.define.string(),
  type: schema.define.literal('theme'),
})

export const BaseFunctionConfigurationSchema = schema.define.object({
  name: schema.define.string(),
  type: schema.define.string(),
  description: schema.define.string().optional().default(''),
  build: schema.define.object({
    command: schema.define.string(),
    path: schema.define.string().optional(),
  }),
  configurationUi: schema.define.boolean().optional().default(true),
  ui: schema.define
    .object({
      enable_create: schema.define.boolean().optional(),
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

export type NewExtensionPointSchemaType = schema.define.infer<typeof NewExtensionPointSchema>
