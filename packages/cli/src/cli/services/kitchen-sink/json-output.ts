import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const SampleItemSchema = zod.object({
  id: zod.number(),
  name: zod.string(),
})

export const kitchenSinkJsonOutputSchema = defineJsonOutputSchema({
  name: 'KitchenSinkJsonOutputResult',
  schema: zod.object({items: zod.array(SampleItemSchema)}),
  definitions: {SampleItem: SampleItemSchema},
})

type KitchenSinkJsonOutputResult = InferJsonOutputSchema<typeof kitchenSinkJsonOutputSchema>

export function createKitchenSinkJsonOutput(): KitchenSinkJsonOutputResult {
  return {items: [{id: 1, name: 'Example'}]}
}
