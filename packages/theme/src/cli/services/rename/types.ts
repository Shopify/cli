import {ThemeMutationSuccessSchema} from '../theme-mutation/status.js'
import {ThemeMutationThemeSchema} from '../theme-mutation/types.js'
import {defineJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'
import type {Theme} from '@shopify/cli-kit/node/themes/types'

const ThemeRenameResultSchema = ThemeMutationSuccessSchema.extend({
  originalName: zod.string(),
  theme: ThemeMutationThemeSchema,
})
const ThemeRenameEnvironmentSchema = zod.object({environment: zod.string(), result: ThemeRenameResultSchema})

export const themeRenameJsonOutputSchema = defineJsonOutputSchema({
  name: 'ThemeRenameResult',
  schema: zod.union([ThemeRenameResultSchema, zod.object({environments: zod.array(ThemeRenameEnvironmentSchema)})]),
  definitions: {RenamedTheme: ThemeMutationThemeSchema, ThemeRenameEnvironment: ThemeRenameEnvironmentSchema},
})

export type ThemeRenameData = zod.infer<typeof ThemeRenameResultSchema>
export interface ThemeRenameResult {
  data: ThemeRenameData
  originalTheme: Theme
  requestedName: string
}
