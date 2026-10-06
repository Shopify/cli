import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

export const autoUpgradeJsonOutputSchema = defineJsonOutputSchema({
  name: 'AutoUpgradeResult',
  schema: zod.object({enabled: zod.boolean()}).strict(),
})

export type AutoUpgradeResult = InferJsonOutputSchema<typeof autoUpgradeJsonOutputSchema>
