import {defineJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

export const authLoginJsonOutputSchema = defineJsonOutputSchema({
  name: 'AuthLoginResult',
  schema: zod
    .object({
      status: zod.literal('success'),
      userId: zod.string().describe('The identity provider user ID of the selected Shopify account.'),
      alias: zod.string(),
      email: zod
        .string()
        .min(1)
        .nullable()
        .describe('The email returned by authentication, or null when it is not stored.'),
    })
    .strict(),
})
