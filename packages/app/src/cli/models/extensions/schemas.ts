import {schema} from '@shopify/cli-kit'

export const MetafieldSchema = schema.define.object({
  namespace: schema.define.string(),
  key: schema.define.string(),
})

export const CapabilitiesSchema = schema.define.object({
  network_access: schema.define.boolean().optional(),
  block_progress: schema.define.boolean().optional(),
})

export const TypeSchema = schema.define.object({
  type: schema.define.string().default('ui-extension'),
})

export const ExtensionPointSchema = schema.define.object({
  type: schema.define.string(),
  module: schema.define.string(),
  metafields: schema.define.array(MetafieldSchema).optional(),
  capabilities: CapabilitiesSchema.optional(),
})

export const BaseExtensionSchema = schema.define.object({
  name: schema.define.string(),
  type: schema.define.string(),
  extension_points: schema.define.array(ExtensionPointSchema).optional(),
  capabilities: schema.define
    .object({
      block_progress: schema.define.boolean().optional(),
      network_access: schema.define.boolean().optional(),
    })
    .optional(),
  metafields: schema.define.array(MetafieldSchema).optional(),
})

export const BaseFunctionConfigurationSchema = schema.define.object({
  name: schema.define.string(),
  type: schema.define.string(),
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

export const BaseFunctionMetadataSchema = schema.define.object({
  schemaVersions: schema.define.object({}).catchall(
    schema.define.object({
      major: schema.define.number(),
      minor: schema.define.number(),
    }),
  ),
})
