import {defineThemeJsonOutputSchema, ThemeSchema as PublicThemeSchema, projectTheme} from '../json-output/schema.js'
import {zod} from '@shopify/cli-kit/node/schema'

const ThemeListThemeSchema = zod.object({
  id: zod.number(),
  name: zod.string(),
  processing: zod.boolean(),
  createdAtRuntime: zod.boolean(),
  role: zod.string(),
})
const ThemeListResultSchema = zod.array(ThemeListThemeSchema)
export const themeListJsonOutputSchema = defineThemeJsonOutputSchema({
  name: 'ThemeListResult',
  schema: zod
    .object({themes: zod.array(PublicThemeSchema.extend({processing: zod.boolean()}).strict())})
    .strict()
    .describe('The complete theme library after applying the requested filters.'),
  definitions: {Theme: PublicThemeSchema},
  project(value) {
    return {
      themes: ThemeListResultSchema.parse(value).map((theme) => ({
        ...projectTheme(theme),
        processing: theme.processing,
      })),
    }
  },
})

export type ThemeListResult = zod.infer<typeof ThemeListResultSchema>
