import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

export const themePreviewJsonOutputSchema = defineJsonOutputSchema({
  name: 'ThemePreviewResult',
  schema: zod.object({
    url: zod.string(),
    preview_identifier: zod.string(),
  }),
})

export type ThemePreviewResult = InferJsonOutputSchema<typeof themePreviewJsonOutputSchema>
