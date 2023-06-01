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

export const BaseSchema = zod.object({
  name: zod.string(),
  type: zod.string(),
  description: zod.string().optional(),
  apiVersion: ApiVersionSchema.optional(),
  extensionPoints: zod.any().optional(),
  capabilities: CapabilitiesSchema.optional(),
  metafields: zod.array(MetafieldSchema).optional().default([]),
  categories: zod.array(zod.string()).optional(),
})

export type NewExtensionPointSchemaType = zod.infer<typeof NewExtensionPointSchema>

// Base config type that all config schemas must extend.
export type BaseConfigType = zod.infer<typeof BaseSchema>
