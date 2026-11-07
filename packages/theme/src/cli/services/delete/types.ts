import {
  ThemeMutationThemeSchema,
  ThemeMutationJsonThemeSchema,
  projectThemeMutationTheme,
} from '../theme-mutation/types.js'
import {defineThemeJsonOutputSchema} from '../json-output/schema.js'
import {zod} from '@shopify/cli-kit/node/schema'

const ThemeDeleteResultSchema = zod.object({
  status: zod.enum(['success', 'partial']),
  themes: zod.array(ThemeMutationThemeSchema),
  errors: zod.array(zod.object({themeId: zod.number(), message: zod.string()})).optional(),
})
export const themeDeleteJsonOutputSchema = defineThemeJsonOutputSchema({
  name: 'ThemeDeleteResult',
  schema: zod
    .object({
      status: zod.enum(['success', 'partial']),
      changed: zod.boolean(),
      themes: zod.array(ThemeMutationJsonThemeSchema),
      errors: zod
        .array(
          zod
            .object({
              themeId: zod.string().regex(/^\d+$/),
              error: zod.object({type: zod.literal('abort'), message: zod.string()}).strict(),
            })
            .strict(),
        )
        .optional(),
    })
    .strict(),
  definitions: {Theme: ThemeMutationJsonThemeSchema},
  project(value) {
    const result = ThemeDeleteResultSchema.parse(value)
    return {
      status: result.status,
      changed: result.themes.length > 0,
      themes: result.themes.map(projectThemeMutationTheme),
      ...(result.errors
        ? {
            errors: result.errors.map((error) => ({
              themeId: String(error.themeId),
              error: {type: 'abort', message: error.message},
            })),
          }
        : {}),
    }
  },
})

export type ThemeDeleteResult = zod.infer<typeof ThemeDeleteResultSchema>
