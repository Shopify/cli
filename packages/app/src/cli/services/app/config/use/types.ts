import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'
import {isAbsolutePath} from '@shopify/cli-kit/node/path'

export const appConfigUseJsonOutputSchema = defineJsonOutputSchema({
  name: 'AppConfigUseResult',
  schema: zod
    .object({
      status: zod.literal('success'),
      changed: zod.boolean().describe('Whether the preferred configuration changed.'),
      path: zod
        .string()
        .refine(isAbsolutePath, 'Expected an absolute filesystem path.')
        .nullable()
        .describe('The preferred configuration file, or null after clearing the preference.'),
      clientId: zod
        .string()
        .min(1)
        .nullable()
        .describe('The public OAuth client identifier, or null after clearing the preference.'),
    })
    .strict(),
})

export type AppConfigUseResult = InferJsonOutputSchema<typeof appConfigUseJsonOutputSchema>
