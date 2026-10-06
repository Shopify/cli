import {ThemeMutationSuccessSchema} from '../theme-mutation/status.js'
import {
  ThemeMutationThemeSchema,
  ThemeMutationJsonThemeSchema,
  projectThemeMutationTheme,
} from '../theme-mutation/types.js'
import {defineThemeJsonOutputSchema} from '../json-output/schema.js'
import {zod} from '@shopify/cli-kit/node/schema'
import type {Theme} from '@shopify/cli-kit/node/themes/types'

const ThemePublishResultSchema = ThemeMutationSuccessSchema.extend({
  theme: ThemeMutationThemeSchema,
})
export const themePublishJsonOutputSchema = defineThemeJsonOutputSchema({
  name: 'ThemePublishResult',
  schema: zod
    .object({status: zod.literal('success'), changed: zod.boolean(), theme: ThemeMutationJsonThemeSchema})
    .strict(),
  definitions: {Theme: ThemeMutationJsonThemeSchema},
  project(value) {
    const result = ThemePublishResultSchema.parse(value)
    return {status: result.status, changed: true, theme: projectThemeMutationTheme(result.theme)}
  },
})

export type ThemePublishData = zod.infer<typeof ThemePublishResultSchema>
export interface ThemePublishResult {
  data: ThemePublishData
  originalTheme: Theme
  previewUrl: string
}
