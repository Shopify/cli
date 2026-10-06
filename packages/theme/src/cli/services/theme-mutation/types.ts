import {ThemeSchema, StoreDomainSchema, projectTheme, storeDomain} from '../json-output/schema.js'
import {zod} from '@shopify/cli-kit/node/schema'

export const ThemeMutationThemeSchema = zod.object({
  id: zod.number(),
  name: zod.string(),
  role: zod.string(),
  processing: zod.boolean(),
  createdAtRuntime: zod.boolean(),
  src: zod.string().optional(),
  shop: zod.string(),
})

export const ThemeMutationJsonThemeSchema = ThemeSchema.extend({
  storeDomain: StoreDomainSchema,
  processing: zod.boolean(),
  sourceUrl: zod.string().url().nullable(),
})
  .strict()
  .describe('The selected theme projection; sourceUrl is null when the upstream source URL is unavailable.')

export function projectThemeMutationTheme(theme: zod.infer<typeof ThemeMutationThemeSchema>) {
  return {
    ...projectTheme(theme),
    storeDomain: storeDomain(theme.shop),
    processing: theme.processing,
    sourceUrl: theme.src === '' ? null : (theme.src ?? null),
  }
}
