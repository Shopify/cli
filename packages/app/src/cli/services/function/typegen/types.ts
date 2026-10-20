import {functionIdentitySchema} from '../types.js'
import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

export const functionTypegenJsonOutputSchema = defineJsonOutputSchema({
  name: 'FunctionTypegenResult',
  schema: zod
    .object({
      status: zod.literal('success'),
      function: functionIdentitySchema,
    })
    .strict(),
  definitions: {Function: functionIdentitySchema},
})

export type FunctionTypegenResult = InferJsonOutputSchema<typeof functionTypegenJsonOutputSchema>
