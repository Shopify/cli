import {
  defineThemeJsonOutputSchema,
  ThemeSchema as PublicThemeSchema,
  StoreDomainSchema,
  projectTheme,
  storeDomain,
} from '../json-output/schema.js'
import {zod} from '@shopify/cli-kit/node/schema'

const ThemeSchema = zod.object({
  id: zod.number(),
  name: zod.string(),
  createdAtRuntime: zod.boolean(),
  processing: zod.boolean(),
  role: zod.string(),
  src: zod.string().optional(),
})

const ThemeOpenServiceSchema = zod.object({theme: ThemeSchema, preview_url: zod.string(), editor_url: zod.string()})
export const themeOpenJsonOutputSchema = defineThemeJsonOutputSchema({
  name: 'ThemeOpenResult',
  schema: zod
    .object({
      theme: PublicThemeSchema.extend({
        storeDomain: StoreDomainSchema,
        previewUrl: zod.string().url(),
        editorUrl: zod.string().url(),
        processing: zod.boolean(),
        sourceUrl: zod.string().url().nullable(),
      }).strict(),
    })
    .strict(),
  definitions: {Theme: PublicThemeSchema},
  project(value) {
    const result = ThemeOpenServiceSchema.parse(value)
    return {
      theme: {
        ...projectTheme(result.theme),
        storeDomain: storeDomain(new URL(result.preview_url).hostname),
        previewUrl: result.preview_url,
        editorUrl: result.editor_url,
        processing: result.theme.processing,
        sourceUrl: result.theme.src ?? null,
      },
    }
  },
})

export type ThemeOpenResult = zod.infer<typeof ThemeOpenServiceSchema>
