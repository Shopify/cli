import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const ThemeSchema = zod.object({id: zod.number(), name: zod.string(), role: zod.string()})
const DuplicatedThemeSchema = ThemeSchema.extend({shop: zod.string()})
const DuplicateErrorSchema = zod.object({
  message: zod.string(),
  errors: zod.array(zod.string()),
  requestId: zod.string().optional(),
})

export const themeDuplicateJsonOutputSchema = defineJsonOutputSchema({
  name: 'ThemeDuplicateResult',
  schema: zod.union([zod.object({theme: DuplicatedThemeSchema}), DuplicateErrorSchema]),
  definitions: {DuplicatedTheme: DuplicatedThemeSchema, ThemeDuplicateError: DuplicateErrorSchema},
})

export type ThemeDuplicateJsonResult = InferJsonOutputSchema<typeof themeDuplicateJsonOutputSchema>

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
