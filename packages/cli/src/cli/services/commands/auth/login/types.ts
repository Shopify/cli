import {defineJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

export const authLoginJsonOutputSchema = defineJsonOutputSchema({
  name: 'AuthLoginResult',
  schema: zod.object({status: zod.literal('success'), alias: zod.string()}).strict(),
})
