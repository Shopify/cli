import {ThemeMutationSuccessSchema} from '../theme-mutation/status.js'
import {ThemeMutationThemeSchema} from '../theme-mutation/types.js'
import {defineJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'
import type {Theme} from '@shopify/cli-kit/node/themes/types'

const ThemePublishResultSchema = ThemeMutationSuccessSchema.extend({theme: ThemeMutationThemeSchema})
const ThemePublishEnvironmentSchema = zod.object({environment: zod.string(), result: ThemePublishResultSchema})

export const themePublishJsonOutputSchema = defineJsonOutputSchema({
  name: 'ThemePublishResult',
  schema: zod.union([ThemePublishResultSchema, zod.object({environments: zod.array(ThemePublishEnvironmentSchema)})]),
  definitions: {PublishedTheme: ThemeMutationThemeSchema, ThemePublishEnvironment: ThemePublishEnvironmentSchema},
})

export type ThemePublishData = zod.infer<typeof ThemePublishResultSchema>
export interface ThemePublishResult {
  data: ThemePublishData
  originalTheme: Theme
  previewUrl: string
}
