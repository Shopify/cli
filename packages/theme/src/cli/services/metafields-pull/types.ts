import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const MetafieldTypeSchema = zod.object({name: zod.string(), category: zod.string()})
const MetafieldDefinitionSchema = zod.object({
  key: zod.string(),
  namespace: zod.string(),
  name: zod.string(),
  description: zod.string().nullish(),
  type: MetafieldTypeSchema,
})
export const handleToOwnerType = {
  article: 'ARTICLE',
  blog: 'BLOG',
  collection: 'COLLECTION',
  company: 'COMPANY',
  company_location: 'COMPANY_LOCATION',
  location: 'LOCATION',
  market: 'MARKET',
  order: 'ORDER',
  page: 'PAGE',
  product: 'PRODUCT',
  variant: 'PRODUCTVARIANT',
  shop: 'SHOP',
} as const

// Object.fromEntries widens the keys, but every supported handle is required in the output.
const DefinitionsSchema = zod.object(
  Object.fromEntries(
    Object.keys(handleToOwnerType).map((handle) => [handle, zod.array(MetafieldDefinitionSchema)]),
  ) as {
    [Handle in keyof typeof handleToOwnerType]: zod.ZodArray<typeof MetafieldDefinitionSchema>
  },
)
const OwnerTypeSchema = zod.nativeEnum(handleToOwnerType)

export const themeMetafieldsPullJsonOutputSchema = defineJsonOutputSchema({
  name: 'ThemeMetafieldsPullResult',
  schema: zod.discriminatedUnion('status', [
    zod.object({
      status: zod.literal('downloaded'),
      path: zod.string(),
      definitions: DefinitionsSchema,
      failedOwnerTypes: zod.array(OwnerTypeSchema),
    }),
    zod.object({status: zod.literal('failed'), failedOwnerTypes: zod.array(OwnerTypeSchema)}),
    zod.object({status: zod.literal('skipped'), reason: zod.enum(['not-a-theme', 'cancelled'])}),
  ]),
  definitions: {
    MetafieldOwnerType: OwnerTypeSchema,
    MetafieldType: MetafieldTypeSchema,
    MetafieldDefinition: MetafieldDefinitionSchema,
    MetafieldDefinitions: DefinitionsSchema,
  },
})

export type ThemeMetafieldsPullResult = InferJsonOutputSchema<typeof themeMetafieldsPullJsonOutputSchema>
export type MetafieldDefinitions = zod.infer<typeof DefinitionsSchema>
