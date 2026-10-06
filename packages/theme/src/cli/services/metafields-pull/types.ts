import {defineThemeJsonOutputSchema} from '../json-output/schema.js'
import {isAbsolutePath} from '@shopify/cli-kit/node/path'
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
const _DefinitionsSchema = zod.object(
  Object.fromEntries(
    Object.keys(handleToOwnerType).map((handle) => [handle, zod.array(MetafieldDefinitionSchema)]),
  ) as {
    [Handle in keyof typeof handleToOwnerType]: zod.ZodArray<typeof MetafieldDefinitionSchema>
  },
)

// The language server consumes the existing owner-keyed .shopify/metafields.json artifact.
// Its native keys and upstream type names are preserved in the file, not in the CLI wrapper.
export type MetafieldDefinitions = zod.infer<typeof _DefinitionsSchema>
export type ThemeMetafieldsPullResult =
  | {status: 'downloaded'; path: string; definitions: MetafieldDefinitions; failedOwnerTypes: string[]}
  | {status: 'failed'; failedOwnerTypes: string[]}
  | {status: 'skipped'; reason: 'not-a-theme' | 'cancelled'}

const PublicDefinitionSchema = zod
  .object({
    ownerType: zod.string().describe('The upstream owner type, such as PRODUCT or COMPANY_LOCATION.'),
    key: zod.string(),
    namespace: zod.string(),
    name: zod.string(),
    description: zod.string().nullable(),
    type: zod
      .object({
        name: zod.string().describe('The upstream metafield type, such as single_line_text_field.'),
        category: zod.string().describe('The upstream metafield category.'),
      })
      .strict(),
  })
  .strict()

export const themeMetafieldsPullJsonOutputSchema = defineThemeJsonOutputSchema({
  name: 'ThemeMetafieldsPullResult',
  schema: zod.union([
    zod
      .object({
        status: zod.enum(['success', 'partial']),
        changed: zod.literal(true),
        path: zod
          .string()
          .refine(isAbsolutePath)
          .describe('The absolute path of the native language-server metafields JSON artifact.'),
        definitions: zod
          .array(PublicDefinitionSchema)
          .describe('All fetched definitions, flattened across owner types.'),
        failedOwnerTypes: zod.array(zod.string()).describe('Upstream owner types whose fetch failed.'),
      })
      .strict(),
    zod.object({status: zod.literal('skipped'), reason: zod.literal('not-a-theme')}).strict(),
  ]),
  definitions: {MetafieldDefinition: PublicDefinitionSchema},
  project: (value) => {
    const result = value as ThemeMetafieldsPullResult
    if (result.status === 'failed') throw new Error('Failed downloads must use the fatal error envelope.')
    if (result.status === 'skipped') {
      return result.reason === 'cancelled' ? {status: 'cancelled'} : {status: 'skipped', reason: result.reason}
    }
    return {
      status: result.failedOwnerTypes.length ? 'partial' : 'success',
      changed: true,
      path: result.path,
      definitions: Object.entries(result.definitions).flatMap(([handle, definitions]) =>
        definitions.map((definition) => ({
          ownerType: handleToOwnerType[handle as keyof typeof handleToOwnerType],
          key: definition.key,
          namespace: definition.namespace,
          name: definition.name,
          description: definition.description ?? null,
          type: {name: definition.type.name, category: definition.type.category},
        })),
      ),
      failedOwnerTypes: result.failedOwnerTypes,
    }
  },
})
