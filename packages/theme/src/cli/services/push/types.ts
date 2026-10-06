import {defineThemeJsonOutputSchema, ThemeLinksSchema, projectTheme, storeDomain} from '../json-output/schema.js'
import {zod} from '@shopify/cli-kit/node/schema'
import {cwd, isAbsolutePath} from '@shopify/cli-kit/node/path'
// Native JSON paths must preserve Windows separators instead of pathe normalization.
// eslint-disable-next-line no-restricted-imports
import {resolve as resolvePath} from 'node:path'

const ThemePushThemeSchema = zod.object({
  id: zod.number(),
  name: zod.string(),
  role: zod.string(),
  shop: zod.string(),
  editor_url: zod.string(),
  preview_url: zod.string(),
})

export const themePushResultSchema = zod.object({
  environment: zod.string().optional(),
  directory: zod.string().optional(),
  changed: zod.boolean().optional(),
  theme: ThemePushThemeSchema,
  published: zod.boolean(),
  hasErrors: zod.boolean(),
  errors: zod.record(zod.array(zod.string())),
})

const ThemePushJsonResultSchema = zod
  .object({
    status: zod.enum(['success', 'partial']),
    changed: zod.boolean(),
    theme: ThemeLinksSchema,
    issues: zod.array(
      zod
        .object({
          filePath: zod.string().refine(isAbsolutePath, 'Expected an absolute filesystem path.'),
          message: zod.string(),
        })
        .strict(),
    ),
  })
  .strict()
const SkippedSchema = zod.object({status: zod.literal('skipped'), reason: zod.literal('unsafe-directory')}).strict()

export function themePushJsonResult(result: ThemePushResult): ThemePushJsonResult {
  const {theme, hasErrors, errors} = result
  return {
    status: hasErrors ? 'partial' : 'success',
    changed: result.changed ?? true,
    theme: {
      ...projectTheme(theme),
      storeDomain: storeDomain(theme.shop),
      editorUrl: theme.editor_url || null,
      previewUrl: theme.preview_url || null,
    },
    issues: Object.entries(errors).flatMap(([file, messages]) =>
      messages.map((message) => ({filePath: resolvePath(result.directory ?? cwd(), file), message})),
    ),
  }
}

export const themePushJsonOutputSchema = defineThemeJsonOutputSchema({
  name: 'ThemePushJsonResult',
  schema: zod.union([ThemePushJsonResultSchema, SkippedSchema]),
  definitions: {ThemePushTheme: ThemeLinksSchema},
  project: (value) => {
    if (SkippedSchema.safeParse(value).success || ThemePushJsonResultSchema.safeParse(value).success) return value
    return themePushJsonResult(themePushResultSchema.parse(value))
  },
})

export type ThemePushResult = zod.infer<typeof themePushResultSchema>
type ThemePushJsonResult = zod.infer<typeof ThemePushJsonResultSchema>
