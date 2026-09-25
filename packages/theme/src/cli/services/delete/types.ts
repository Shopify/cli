import {ThemeMutationThemeSchema} from '../theme-mutation/types.js'
import {defineJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const ThemeDeleteResultSchema = zod.object({themes: zod.array(ThemeMutationThemeSchema)})
const ThemeDeleteEnvironmentSchema = zod.object({environment: zod.string(), result: ThemeDeleteResultSchema})

export const themeDeleteJsonOutputSchema = defineJsonOutputSchema({
  name: 'ThemeDeleteResult',
  schema: zod.union([ThemeDeleteResultSchema, zod.object({environments: zod.array(ThemeDeleteEnvironmentSchema)})]),
  definitions: {DeletedTheme: ThemeMutationThemeSchema, ThemeDeleteEnvironment: ThemeDeleteEnvironmentSchema},
})

export type ThemeDeleteResult = zod.infer<typeof ThemeDeleteResultSchema>
