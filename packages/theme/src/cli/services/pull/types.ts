import {defineThemeJsonOutputSchema, ThemeLinksSchema, projectTheme, storeDomain} from '../json-output/schema.js'
import {isAbsolutePath, resolvePath} from '@shopify/cli-kit/node/path'
import {zod} from '@shopify/cli-kit/node/schema'

const ThemePullThemeSchema = zod.object({
  id: zod.number(),
  name: zod.string(),
  role: zod.string(),
  processing: zod.boolean(),
  src: zod.string().optional(),
  shop: zod.string(),
  editor_url: zod.string(),
  preview_url: zod.string(),
})

export const themePullResultSchema = zod.object({
  environment: zod.string().optional(),
  path: zod.string(),
  changed: zod.boolean().optional(),
  theme: ThemePullThemeSchema,
})

const ThemePullJsonThemeSchema = ThemeLinksSchema.extend({
  processing: zod.boolean(),
  sourceUrl: zod.string().url().nullable(),
}).strict()
const ThemePullJsonResultSchema = zod
  .object({
    status: zod.literal('success'),
    changed: zod.boolean(),
    directory: zod.string().refine(isAbsolutePath, 'Expected an absolute filesystem path.'),
    theme: ThemePullJsonThemeSchema,
  })
  .strict()
const SkippedSchema = zod.object({status: zod.literal('skipped'), reason: zod.literal('unsafe-directory')}).strict()

export const themePullJsonOutputSchema = defineThemeJsonOutputSchema({
  name: 'ThemePullResult',
  schema: zod.union([ThemePullJsonResultSchema, SkippedSchema]),
  definitions: {ThemePullTheme: ThemePullJsonThemeSchema},
  project: (value) => {
    if (SkippedSchema.safeParse(value).success) return value
    const {theme, path, changed} = themePullResultSchema.parse(value)
    return {
      status: 'success',
      changed: changed ?? true,
      directory: resolvePath(path),
      theme: {
        ...projectTheme(theme),
        storeDomain: storeDomain(theme.shop),
        processing: theme.processing,
        sourceUrl: theme.src === '' ? null : (theme.src ?? null),
        editorUrl: theme.editor_url || null,
        previewUrl: theme.preview_url || null,
      },
    }
  },
})

export type ThemePullResult = zod.infer<typeof themePullResultSchema>
