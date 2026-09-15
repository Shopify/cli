import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

export const versionJsonOutputSchema = defineJsonOutputSchema({
  name: 'VersionResult',
  schema: zod.object({version: zod.string()}),
})

export type VersionResult = InferJsonOutputSchema<typeof versionJsonOutputSchema>
