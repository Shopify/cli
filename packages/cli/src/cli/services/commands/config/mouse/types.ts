import {defineJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

export const mouseJsonOutputSchema = defineJsonOutputSchema({
  name: 'MouseConfigurationResult',
  schema: zod.object({enabled: zod.boolean()}),
})
