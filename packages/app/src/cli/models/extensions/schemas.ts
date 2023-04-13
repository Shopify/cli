import {zod} from '@shopify/cli-kit/node/schema'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ZodSchemaType<T> = zod.ZodType<T, any, any>

export const MetafieldSchema = zod.object({
  namespace: zod.string(),
  key: zod.string(),
})

export const CapabilitiesSchema = zod.object({
  network_access: zod.boolean().optional(),
  block_progress: zod.boolean().optional(),
  api_access: zod.boolean().optional(),
})

export const TypeSchema = zod.object({
  type: zod.string().default('ui_extension'),
})

export const NewExtensionPointSchema = zod.object({
  target: zod.string(),
  module: zod.string(),
  label: zod.string().optional(),
  metafields: zod.array(MetafieldSchema).optional(),
})

export const OldExtensionPointsSchema = zod.array(zod.string()).default([])
export const NewExtensionPointsSchema = zod.array(NewExtensionPointSchema)
export const ExtensionPointSchema = zod.union([OldExtensionPointsSchema, NewExtensionPointsSchema])
export const ApiVersionSchema = zod.string()

export type ApiVersionSchemaType = zod.infer<typeof ApiVersionSchema>

export const BaseUIExtensionSchema = zod.object({
  name: zod.string(),
  description: zod.string().optional(),
  type: zod.string().default('ui_extension'),
  apiVersion: ApiVersionSchema.optional(),
  extensionPoints: zod.any().optional(),
  capabilities: CapabilitiesSchema.optional(),
  metafields: zod.array(MetafieldSchema).optional().default([]),
  categories: zod.array(zod.string()).optional(),
})

export const ThemeExtensionSchema = zod.object({
  name: zod.string(),
  type: zod.literal('theme'),
})

export const BaseFunctionConfigurationSchema = zod.object({
  name: zod.string(),
  type: zod.string(),
  description: zod.string().optional().default(''),
  build: zod.object({
    command: zod
      .string()
      .transform((value) => (value.trim() === '' ? undefined : value))
      .optional(),
    path: zod.string().optional(),
  }),
  configurationUi: zod.boolean().optional().default(true),
  ui: zod
    .object({
      enable_create: zod.boolean().optional(),
      paths: zod
        .object({
          create: zod.string(),
          details: zod.string(),
        })
        .optional(),
    })
    .optional(),
  apiVersion: zod.string(),
  input: zod
    .object({
      variables: zod
        .object({
          namespace: zod.string(),
          key: zod.string(),
        })
        .optional(),
    })
    .optional(),
})

export type NewExtensionPointSchemaType = zod.infer<typeof NewExtensionPointSchema>

// Base config type that all config schemas must extend.
export type BaseConfigContents = zod.infer<typeof BaseUIExtensionSchema>
