import {zod} from '@shopify/cli-kit/node/schema'

export const MAX_EXTENSION_HANDLE_LENGTH = 50

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ZodSchemaType<T> = zod.ZodType<T, any, any>

const MetafieldSchema = zod.object({
  namespace: zod.string(),
  key: zod.string(),
})

export const MetafieldSchemaAsJson = {
  type: 'object',
  properties: {
    key: {type: 'string'},
    namespace: {type: 'string'},
  },
  required: ['key', 'namespace'],
}

const CollectBuyerConsentCapabilitySchema = zod.object({
  sms_marketing: zod.boolean().optional(),
  customer_privacy: zod.boolean().optional(),
})

const IframeCapabilitySchema = zod.object({
  sources: zod.array(zod.string()).optional(),
})

const CapabilitiesSchema = zod.object({
  network_access: zod.boolean().optional(),
  block_progress: zod.boolean().optional(),
  api_access: zod.boolean().optional(),
  collect_buyer_consent: CollectBuyerConsentCapabilitySchema.optional(),
  iframe: IframeCapabilitySchema.optional(),
})

export const ExtensionsArraySchema = zod.object({
  type: zod.string().optional(),
  extensions: zod.array(zod.any()).optional(),
})

const TargetCapabilitiesSchema = zod.object({
  allow_direct_linking: zod.boolean().optional(),
})

const ShouldRenderSchema = zod.object({
  module: zod.string(),
})

const NewExtensionPointSchema = zod.object({
  target: zod.string(),
  module: zod.string(),
  should_render: ShouldRenderSchema.optional(),
  metafields: zod.array(MetafieldSchema).optional(),
  default_placement: zod.string().optional(),
  urls: zod
    .object({
      edit: zod.string().optional(),
    })
    .optional(),
  capabilities: TargetCapabilitiesSchema.optional(),
  preloads: zod
    .object({
      chat: zod.string().optional(),
    })
    .optional(),
})

export const NewExtensionPointsSchemaAsJson = {
  type: 'object',
  properties: {
    target: {type: 'string'},
    module: {type: 'string'},
    should_render: {
      type: 'object',
      properties: {
        module: {type: 'string'},
      },
      required: ['module'],
    },
    metafields: {
      type: 'array',
      items: MetafieldSchemaAsJson,
    },
    default_placement: {type: 'string'},
    urls: {
      type: 'object',
      properties: {
        edit: {type: 'string'},
      },
    },
    capabilities: {
      type: 'object',
      properties: {
        allow_direct_linking: {type: 'boolean'},
      },
    },
    preloads: {
      type: 'object',
      properties: {
        chat: {type: 'string'},
      },
    },
  },
  required: ['target', 'module'],
}

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

export const SettingsSchemaAsJson = {
  type: 'object',
  properties: {
    fields: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: {type: 'string'},
          name: {type: 'string'},
          description: {type: 'string'},
          required: {type: 'boolean'},
          type: {type: 'string'},
          validations: {type: 'array', items: {type: 'object'}},
          marketingActivityCreateUrl: {type: 'string'},
          marketingActivityDeleteUrl: {type: 'string'},
        },
        required: ['type'],
        additionalProperties: true,
      },
    },
  },
}

const HandleSchema = zod
  .string()
  .trim()
  .nonempty("Handle can't be empty")
  .max(MAX_EXTENSION_HANDLE_LENGTH, `Handle can't exceed ${MAX_EXTENSION_HANDLE_LENGTH} characters`)
  .regex(/^[a-zA-Z0-9-]*$/, 'Handle can only contain alphanumeric characters and hyphens')
  .refine((handle) => !handle.startsWith('-') && !handle.endsWith('-'), "Handle can't start or end with a hyphen")
  .refine((handle) => [...handle].some((char) => char !== '-'), "Handle can't be all hyphens")

export const BaseSchema = zod.object({
  name: zod.string().optional(),
  type: zod.string().optional(),
  handle: HandleSchema.optional(),
  uid: zod.string().optional(),
  description: zod.string().optional(),
  api_version: ApiVersionSchema.optional(),
  extension_points: zod.any().optional(),
  capabilities: CapabilitiesSchema.optional(),
  metafields: zod.array(MetafieldSchema).optional(),
  settings: SettingsSchema.optional(),
})

export const BaseSchemaWithHandle = BaseSchema.extend({
  handle: HandleSchema,
})

export const BaseSchemaWithHandleAsJson = {
  type: 'object',
  properties: {
    name: {type: 'string'},
    extension_points: {type: 'array', items: NewExtensionPointsSchemaAsJson},
    targeting: {
      type: 'array',
      items: NewExtensionPointsSchemaAsJson,
    },
    handle: {type: 'string'},
    uid: {type: 'string'},
    description: {type: 'string'},
    capabilities: {
      type: 'object',
      properties: {
        network_access: {type: 'boolean'},
        block_progress: {type: 'boolean'},
        api_access: {type: 'boolean'},
        collect_buyer_consent: {
          type: 'object',
          properties: {
            sms_marketing: {type: 'boolean'},
            customer_privacy: {type: 'boolean'},
          },
        },
        iframe: {
          type: 'object',
          properties: {
            sources: {type: 'array', items: {type: 'string'}},
          },
        },
      },
    },
    metafields: {type: 'array', items: MetafieldSchemaAsJson},
    settings: SettingsSchemaAsJson,
  },
  required: ['name', 'type', 'handle'],
  additionalProperties: false,
}

export const UnifiedSchema = zod.object({
  api_version: ApiVersionSchema.optional(),
  description: zod.string().optional(),
  extensions: zod.array(zod.any()),
  settings: SettingsSchema.optional(),
})

export type NewExtensionPointSchemaType = zod.infer<typeof NewExtensionPointSchema>

// Base config type that all config schemas must extend.
export type BaseConfigType = zod.infer<typeof BaseSchema>
