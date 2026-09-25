import {defineJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const ThemePullThemeSchema = zod.object({
  id: zod.number(),
  name: zod.string(),
  role: zod.string(),
  processing: zod.boolean(),
  src: zod.string().optional(),
  shop: zod.string(),
  editor_url: zod.string(),
  preview_url: zod.string(),
})

export const themePullResultSchema = zod.object({
  environment: zod.string().optional(),
  path: zod.string(),
  theme: ThemePullThemeSchema,
})

export const themePullJsonOutputSchema = defineJsonOutputSchema({
  name: 'ThemePullResult',
  schema: zod.union([themePullResultSchema, zod.array(themePullResultSchema.extend({environment: zod.string()}))]),
  definitions: {ThemePullTheme: ThemePullThemeSchema},
})

export type ThemePullResult = zod.infer<typeof themePullResultSchema>
