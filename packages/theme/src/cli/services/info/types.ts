import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const ThemeInfoThemeSchema = zod.object({
  id: zod.number(),
  name: zod.string(),
  role: zod.string(),
  shop: zod.string(),
  preview_url: zod.string(),
  editor_url: zod.string(),
})

const ThemeInfoThemeResultSchema = zod.object({
  theme: ThemeInfoThemeSchema,
})

const ThemeEnvironmentInfoSchema = zod.object({
  store: zod.string(),
  development_theme_id: zod.number().nullable(),
  cli_version: zod.string(),
  os: zod.string(),
  shell: zod.string(),
  node_version: zod.string(),
})

export const themeInfoJsonOutputSchema = defineJsonOutputSchema({
  name: 'ThemeInfoResult',
  schema: zod.union([ThemeInfoThemeResultSchema, ThemeEnvironmentInfoSchema]),
  definitions: {
    ThemeInfoTheme: ThemeInfoThemeSchema,
    ThemeInfoThemeResult: ThemeInfoThemeResultSchema,
    ThemeEnvironmentInfo: ThemeEnvironmentInfoSchema,
  },
})

export type ThemeInfoResult = InferJsonOutputSchema<typeof themeInfoJsonOutputSchema>
export type ThemeInfoThemeResult = zod.infer<typeof ThemeInfoThemeResultSchema>
export type ThemeEnvironmentInfo = zod.infer<typeof ThemeEnvironmentInfoSchema>
