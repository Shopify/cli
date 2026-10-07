import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const skippedMetafieldsSchema = zod
  .object({
    type: zod.literal('metafields'),
    ownerType: zod.string().min(1).describe('The Admin API metafield owner type, such as PRODUCT.'),
  })
  .strict()

const skippedMetaobjectsSchema = zod.object({type: zod.literal('metaobjects')}).strict()

export const importCustomDataDefinitionsJsonOutputSchema = defineJsonOutputSchema({
  name: 'ImportCustomDataDefinitionsResult',
  schema: zod
    .object({
      status: zod.literal('success'),
      storeDomain: zod
        .string()
        .regex(/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/)
        .describe('The full myshopify.com domain of the development store.'),
      metafieldCount: zod
        .number()
        .int()
        .nonnegative()
        .describe('The number of available metafields converted to TOML.'),
      metaobjectCount: zod
        .number()
        .int()
        .nonnegative()
        .describe('The number of available metaobjects converted to TOML.'),
      toml: zod.string().describe('Suggested native TOML for app-reserved definitions. No file is written.'),
      skippedSections: zod
        .array(zod.discriminatedUnion('type', [skippedMetafieldsSchema, skippedMetaobjectsSchema]))
        .describe(
          'Sections skipped because required access scopes are unavailable. An empty array means all requests were authorized.',
        ),
    })
    .strict(),
  definitions: {
    SkippedMetafields: skippedMetafieldsSchema,
    SkippedMetaobjects: skippedMetaobjectsSchema,
  },
})

export type ImportCustomDataDefinitionsResult = InferJsonOutputSchema<
  typeof importCustomDataDefinitionsJsonOutputSchema
>

export type ImportDeclarativeDefinitionsResult = Omit<ImportCustomDataDefinitionsResult, 'toml'> & {tomlContent: string}
