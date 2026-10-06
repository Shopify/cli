import {defineThemeJsonOutputSchema} from '../json-output/schema.js'
import {zod} from '@shopify/cli-kit/node/schema'

/** The native preview API response retained for text and compatibility callers. */
export interface ThemePreviewResult {
  url: string
  preview_identifier: string
}

const PreviewSchema = zod
  .object({
    id: zod.string().min(1).describe('The opaque Storefront preview identifier, not a theme ID or Shopify GID.'),
    url: zod.string().url(),
  })
  .strict()

export const themePreviewJsonOutputSchema = defineThemeJsonOutputSchema({
  name: 'ThemePreviewResult',
  schema: zod.object({status: zod.literal('success'), preview: PreviewSchema}).strict(),
  definitions: {ThemePreview: PreviewSchema},
  project: (value) => {
    const result = value as ThemePreviewResult
    return {status: 'success', preview: {id: result.preview_identifier, url: result.url}}
  },
})
