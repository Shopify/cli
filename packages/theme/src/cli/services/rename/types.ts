import {ThemeMutationSuccessSchema} from '../theme-mutation/status.js'
import {
  ThemeMutationThemeSchema,
  ThemeMutationJsonThemeSchema,
  projectThemeMutationTheme,
} from '../theme-mutation/types.js'
import {defineThemeJsonOutputSchema} from '../json-output/schema.js'
import {zod} from '@shopify/cli-kit/node/schema'
import type {Theme} from '@shopify/cli-kit/node/themes/types'

const ThemeRenameResultSchema = ThemeMutationSuccessSchema.extend({
  originalName: zod.string(),
  theme: ThemeMutationThemeSchema,
})
export const themeRenameJsonOutputSchema = defineThemeJsonOutputSchema({
  name: 'ThemeRenameResult',
  schema: zod
    .object({
      status: zod.literal('success'),
      changed: zod.boolean(),
      originalName: zod.string(),
      theme: ThemeMutationJsonThemeSchema,
    })
    .strict(),
  definitions: {Theme: ThemeMutationJsonThemeSchema},
  project(value) {
    const result = ThemeRenameResultSchema.parse(value)
    return {
      status: result.status,
      changed: result.originalName !== result.theme.name,
      originalName: result.originalName,
      theme: projectThemeMutationTheme(result.theme),
    }
  },
})

export type ThemeRenameData = zod.infer<typeof ThemeRenameResultSchema>
export interface ThemeRenameResult {
  data: ThemeRenameData
  originalTheme: Theme
  requestedName: string
}
