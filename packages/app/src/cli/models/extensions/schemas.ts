import {zod} from '@shopify/cli-kit/node/schema'

export const MAX_EXTENSION_HANDLE_LENGTH = 50

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ZodSchemaType<T> = zod.ZodType<T, any, any>

const MetafieldSchema = zod.object({
  namespace: zod.string(),
  key: zod.string(),
})

const CollectBuyerConsentCapabilitySchema = zod.object({
  sms_marketing: zod.boolean().optional(),
  customer_privacy: zod.boolean().optional(),
})

const CapabilitiesSchema = zod.object({
  network_access: zod.boolean().optional(),
  block_progress: zod.boolean().optional(),
  api_access: zod.boolean().optional(),
  collect_buyer_consent: CollectBuyerConsentCapabilitySchema.optional(),
})

export const ExtensionsArraySchema = zod.object({
  type: zod.string().optional(),
  extensions: zod.array(zod.any()).optional(),
})

const TargetCapabilitiesSchema = zod.object({
  allow_direct_linking: zod.boolean().optional(),
})

const NewExtensionPointSchema = zod.object({
  target: zod.string(),
  module: zod.string(),
  metafields: zod.array(MetafieldSchema).optional(),
  default_placement: zod.string().optional(),
  capabilities: TargetCapabilitiesSchema.optional(),
  preloads: zod
    .object({
      chat: zod.string().optional(),
    })
    .optional(),
})

export const NewExtensionPointsSchema = zod.array(NewExtensionPointSchema)
const ApiVersionSchema = zod.string()

export type ApiVersionSchemaType = zod.infer<typeof ApiVersionSchema>

export const FieldSchema = zod.object({
  key: zod.string().optional(),
  name: zod.string().optional(),
  description: zod.string().optional(),
  required: zod.boolean().optional(),
  default_value: zod.any().optional(),
  type: zod.string(),
  validations: zod.array(zod.any()).optional(),
  marketingActivityCreateUrl: zod.string().optional(),
  marketingActivityDeleteUrl: zod.string().optional(),
})

const SettingsSchema = zod.object({
  fields: zod.array(FieldSchema).optional(),
})

const HandleSchema = zod
  .string()
  .trim()
  .nonempty("Handle can't be empty")
  .max(MAX_EXTENSION_HANDLE_LENGTH, `Handle can't exceed ${MAX_EXTENSION_HANDLE_LENGTH} characters`)
  .regex(/^[a-zA-Z0-9-]*$/, 'Handle can only contain alphanumeric characters and hyphens')
  .refine((handle) => !handle.startsWith('-') && !handle.endsWith('-'), "Handle can't start or end with a hyphen")
  .refine((handle) => [...handle].some((char) => char !== '-'), "Handle can't be all hyphens")

export const BaseSchema = zod.object({
  name: zod.string(),
  type: zod.string(),
  handle: HandleSchema.optional(),
  uid: zod.string().optional(),
  description: zod.string().optional(),
  api_version: ApiVersionSchema.optional(),
  extension_points: zod.any().optional(),
  capabilities: CapabilitiesSchema.optional(),
  metafields: zod.array(MetafieldSchema).optional().default([]),
  settings: SettingsSchema.optional(),
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
