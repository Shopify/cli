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

export const ExtensionsArraySchema = zod.object({
  type: zod.string().optional(),
  extensions: zod.array(zod.any()).optional(),
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

export const SettingsSchema = zod.object({
  fields: zod
    .array(
      zod.object({
        key: zod.string().optional(),
        name: zod.string().optional(),
        description: zod.string().optional(),
        required: zod.boolean().optional(),
        type: zod.string(),
      }),
    )
    .optional(),
})

export const HandleSchema = zod
  .string()
  .trim()
  .min(3, 'Handle needs to have at least 3 characters')
  .max(30, "Handle can't exceed 30 characters")
  .regex(/^[a-zA-Z0-9.\-_]*$/, 'Handle can only contain alphanumeric characters, periods, hyphens, and underscores')

export const BaseSchema = zod.object({
  name: zod.string(),
  type: zod.string(),
  handle: HandleSchema.optional(),
  description: zod.string().optional(),
  api_version: ApiVersionSchema.optional(),
  extension_points: zod.any().optional(),
  capabilities: CapabilitiesSchema.optional(),
  metafields: zod.array(MetafieldSchema).optional().default([]),
  categories: zod.array(zod.string()).optional(),
  extensions: zod.array(zod.any()).optional(),
  settings: SettingsSchema.optional(),
})

export const BaseSchemaWithHandle = BaseSchema.extend({
  handle: HandleSchema,
})

export const UnifiedSchema = zod
  .object({
    name: zod.string(),
    api_version: ApiVersionSchema.optional(),
    extensions: zod.array(zod.any()),
  })
  // Include any other field not defined in the schema
  .passthrough()

export type NewExtensionPointSchemaType = zod.infer<typeof NewExtensionPointSchema>

// Base config type that all config schemas must extend.
export type BaseConfigType = zod.infer<typeof BaseSchema>
