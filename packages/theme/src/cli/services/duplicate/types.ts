import {ThemeMutationSuccessSchema} from '../theme-mutation/status.js'
import {
  defineThemeJsonOutputSchema,
  ThemeSchema as PublicThemeSchema,
  StoreDomainSchema,
  projectTheme,
  storeDomain,
} from '../json-output/schema.js'
import {zod} from '@shopify/cli-kit/node/schema'

const ThemeSchema = zod.object({id: zod.number(), name: zod.string(), role: zod.string()})
const DuplicatedThemeSchema = ThemeSchema.extend({shop: zod.string(), preview_url: zod.string().optional()})
const DuplicateErrorSchema = zod.object({
  status: zod.literal('failed'),
  message: zod.string(),
  errors: zod.array(zod.string()),
  requestId: zod.string().optional(),
})

const ThemeDuplicateJsonServiceSchema = zod.discriminatedUnion('status', [
  ThemeMutationSuccessSchema.extend({originalTheme: ThemeSchema, theme: DuplicatedThemeSchema}),
  DuplicateErrorSchema,
])
export const themeDuplicateJsonOutputSchema = defineThemeJsonOutputSchema({
  name: 'ThemeDuplicateResult',
  schema: zod
    .object({
      status: zod.literal('success'),
      changed: zod.boolean(),
      originalTheme: PublicThemeSchema,
      theme: PublicThemeSchema.extend({
        storeDomain: StoreDomainSchema,
        previewUrl: zod.string().url().nullable(),
      }).strict(),
    })
    .strict(),
  definitions: {Theme: PublicThemeSchema},
  project(value) {
    const result = ThemeDuplicateJsonServiceSchema.parse(value)
    if (result.status === 'failed') throw new TypeError('Failed duplications use the shared fatal error document.')
    return {
      status: result.status,
      changed: true,
      originalTheme: projectTheme(result.originalTheme),
      theme: {
        ...projectTheme(result.theme),
        storeDomain: storeDomain(result.theme.shop),
        previewUrl: result.theme.preview_url ?? null,
      },
    }
  },
})

export type ThemeDuplicateJsonResult = zod.infer<typeof ThemeDuplicateJsonServiceSchema>

export const themeDuplicateResultSchema = zod.discriminatedUnion('status', [
  zod.object({status: zod.literal('missing-theme-id')}),
  zod.object({status: zod.literal('not-found'), themeId: zod.string()}),
  zod.object({status: zod.literal('development-theme')}),
  zod.object({status: zod.literal('cancelled')}),
  zod.object({
    status: zod.literal('completed'),
    originalTheme: ThemeSchema.extend({
      createdAtRuntime: zod.boolean().default(false),
      processing: zod.boolean().default(false),
    }),
    shop: zod.string(),
    previewUrl: zod.string().optional(),
    theme: ThemeSchema.optional(),
    userErrors: zod.array(zod.object({field: zod.array(zod.string()).nullish(), message: zod.string()})),
    requestId: zod.string().optional(),
  }),
])

export type ThemeDuplicateResult = zod.infer<typeof themeDuplicateResultSchema>
