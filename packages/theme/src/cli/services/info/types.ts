import {
  defineThemeJsonOutputSchema,
  ThemeLinksSchema,
  ThemeIdSchema,
  themeId,
  StoreDomainSchema,
  storeDomain,
  projectTheme,
} from '../json-output/schema.js'
import {zod} from '@shopify/cli-kit/node/schema'

const ThemeInfoThemeSchema = zod.object({
  id: zod.number(),
  name: zod.string(),
  role: zod.string(),
  shop: zod.string(),
  preview_url: zod.string(),
  editor_url: zod.string(),
})

const ThemeInfoThemeResultSchema = zod.object({
  theme: ThemeInfoThemeSchema,
})

const ThemeEnvironmentInfoSchema = zod.object({
  store: zod.string(),
  development_theme_id: zod.number().nullable(),
  cli_version: zod.string(),
  os: zod.string(),
  shell: zod.string(),
  node_version: zod.string(),
})

const ThemeInfoServiceSchema = zod.union([ThemeInfoThemeResultSchema, ThemeEnvironmentInfoSchema])
const ThemeEnvironmentJsonSchema = zod
  .object({
    storeDomain: StoreDomainSchema,
    developmentThemeId: ThemeIdSchema.nullable(),
    cliVersion: zod.string(),
    os: zod.string(),
    shell: zod.string().nullable(),
    nodeVersion: zod.string(),
  })
  .strict()

export const themeInfoJsonOutputSchema = defineThemeJsonOutputSchema({
  name: 'ThemeInfoResult',
  schema: zod.union([zod.object({theme: ThemeLinksSchema}).strict(), ThemeEnvironmentJsonSchema]),
  definitions: {Theme: ThemeLinksSchema, ThemeEnvironmentInfo: ThemeEnvironmentJsonSchema},
  project(value) {
    const result = ThemeInfoServiceSchema.parse(value)
    if ('theme' in result) {
      return {
        theme: {
          ...projectTheme(result.theme),
          storeDomain: storeDomain(result.theme.shop),
          previewUrl: result.theme.preview_url,
          editorUrl: result.theme.editor_url,
        },
      }
    }
    return {
      storeDomain: storeDomain(result.store),
      developmentThemeId: result.development_theme_id === null ? null : themeId(result.development_theme_id),
      cliVersion: result.cli_version,
      os: result.os,
      shell: result.shell === 'unknown' ? null : result.shell,
      nodeVersion: result.node_version,
    }
  },
})

export type ThemeInfoResult = zod.infer<typeof ThemeInfoServiceSchema>
export type ThemeInfoThemeResult = zod.infer<typeof ThemeInfoThemeResultSchema>
export type ThemeEnvironmentInfo = zod.infer<typeof ThemeEnvironmentInfoSchema>
