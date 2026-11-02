import {appConfigLinkJsonOutputSchema} from '../link/types.js'
import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'

export const appConfigPullJsonOutputSchema = defineJsonOutputSchema({
  name: 'AppConfigPullResult',
  schema: appConfigLinkJsonOutputSchema.schema,
  definitions: appConfigLinkJsonOutputSchema.definitions,
})

export type AppConfigPullResult = InferJsonOutputSchema<typeof appConfigPullJsonOutputSchema>
