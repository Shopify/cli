import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const ThemeSchema = zod.object({
  id: zod.number(),
  name: zod.string(),
  createdAtRuntime: zod.boolean(),
  processing: zod.boolean(),
  role: zod.string(),
  src: zod.string().optional(),
})

export const themeOpenJsonOutputSchema = defineJsonOutputSchema({
  name: 'ThemeOpenResult',
  schema: zod.object({
    theme: ThemeSchema,
    preview_url: zod.string(),
    editor_url: zod.string(),
  }),
  definitions: {Theme: ThemeSchema},
})

export type ThemeOpenResult = InferJsonOutputSchema<typeof themeOpenJsonOutputSchema>
