import {zod} from '@shopify/cli-kit/node/schema'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ZodSchemaType<T> = zod.ZodType<T, any, any>

export const MetafieldSchema = zod.object({
  namespace: zod.string(),
  key: zod.string(),
})

export const CollectBuyerConsentCapabilitySchema = zod.object({
  sms_marketing: zod.boolean().optional(),
  customer_privacy: zod.boolean().optional(),
})

export const CapabilitiesSchema = zod.object({
  network_access: zod.boolean().optional(),
  block_progress: zod.boolean().optional(),
  api_access: zod.boolean().optional(),
  collect_buyer_consent: CollectBuyerConsentCapabilitySchema.optional(),
})

export const ExtensionsArraySchema = zod.object({
  type: zod.string().optional(),
  extensions: zod.array(zod.any()).optional(),
})

export const NewExtensionPointSchema = zod.object({
  target: zod.string(),
  module: zod.string(),
  metafields: zod.array(MetafieldSchema).optional(),
})

export const OldExtensionPointsSchema = zod.array(zod.string()).default([])
export const NewExtensionPointsSchema = zod.array(NewExtensionPointSchema)
export const ExtensionPointSchema = zod.union([OldExtensionPointsSchema, NewExtensionPointsSchema])
export const ApiVersionSchema = zod.string()

export type ApiVersionSchemaType = zod.infer<typeof ApiVersionSchema>

export const FieldSchema = zod.object({
  key: zod.string().optional(),
  name: zod.string().optional(),
  description: zod.string().optional(),
  required: zod.boolean().optional(),
  type: zod.string(),
  validations: zod.array(zod.any()).optional(),
})

export const SettingsSchema = zod.object({
  fields: zod.array(FieldSchema).optional(),
})

export const HandleSchema = zod
  .string()
  .trim()
  .nonempty("Handle can't be empty")
  .max(30, "Handle can't exceed 30 characters")
  .regex(/^[a-zA-Z0-9-]*$/, 'Handle can only contain alphanumeric characters and hyphens')
  .refine((handle) => !handle.startsWith('-') && !handle.endsWith('-'), "Handle can't start or end with a hyphen")
  .refine((handle) => [...handle].some((char) => char !== '-'), "Handle can't be all hyphens")

export const BaseSchema = zod.object({
  name: zod.string(),
  type: zod.string(),
  handle: HandleSchema.optional(),
  description: zod.string().optional(),
  api_version: ApiVersionSchema.optional(),
  extension_points: zod.any().optional(),
  capabilities: CapabilitiesSchema.optional(),
  metafields: zod.array(MetafieldSchema).optional().default([]),
  settings: SettingsSchema.optional(),
  build_directory: zod.string().optional(),
})

export const BaseSchemaWithHandle = BaseSchema.extend({
  handle: HandleSchema,
})

export const UnifiedSchema = zod.object({
  api_version: ApiVersionSchema.optional(),
  description: zod.string().optional(),
  extensions: zod.array(zod.any()),
  settings: SettingsSchema.optional(),
})

export type NewExtensionPointSchemaType = zod.infer<typeof NewExtensionPointSchema>

// Base config type that all config schemas must extend.
export type BaseConfigType = zod.infer<typeof BaseSchema>
