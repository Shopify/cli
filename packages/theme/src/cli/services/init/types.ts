import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

export const themeInitJsonOutputSchema = defineJsonOutputSchema({
  name: 'ThemeInitResult',
  schema: zod.object({
    path: zod.string(),
    repoUrl: zod.string(),
    latest: zod.boolean(),
    aiInstructions: zod.enum(['all', 'github', 'cursor', 'claude']).nullable(),
    instructionFiles: zod.array(zod.string()),
  }),
})

export type ThemeInitResult = InferJsonOutputSchema<typeof themeInitJsonOutputSchema>
