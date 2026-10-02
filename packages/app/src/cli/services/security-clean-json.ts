import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

export const securityCleanJsonOutputSchema = defineJsonOutputSchema({
  name: 'AppSecurityCleanResult',
  schema: zod.object({removed: zod.array(zod.string())}),
})

export type SecurityCleanResult = InferJsonOutputSchema<typeof securityCleanJsonOutputSchema>
