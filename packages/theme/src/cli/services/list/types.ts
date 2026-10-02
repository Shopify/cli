import {defineJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

// Keep the field order produced by buildTheme for existing JSON consumers.
const ThemeListThemeSchema = zod.object({
  id: zod.number(),
  name: zod.string(),
  processing: zod.boolean(),
  createdAtRuntime: zod.boolean(),
  role: zod.string(),
})
const ThemeListResultSchema = zod.array(ThemeListThemeSchema)
const ThemeListEnvironmentSchema = zod.object({
  environment: zod.string(),
  result: ThemeListResultSchema,
})

export const themeListJsonOutputSchema = defineJsonOutputSchema({
  name: 'ThemeListResult',
  schema: zod.union([ThemeListResultSchema, zod.object({environments: zod.array(ThemeListEnvironmentSchema)})]),
  definitions: {ThemeListTheme: ThemeListThemeSchema, ThemeListEnvironment: ThemeListEnvironmentSchema},
})

export type ThemeListResult = zod.infer<typeof ThemeListResultSchema>
