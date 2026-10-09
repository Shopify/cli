import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

export const appBuildJsonOutputSchema = defineJsonOutputSchema({
  name: 'AppBuildResult',
  schema: zod.object({status: zod.literal('success')}).strict(),
})

export type AppBuildResult = InferJsonOutputSchema<typeof appBuildJsonOutputSchema> & {appName: string}
