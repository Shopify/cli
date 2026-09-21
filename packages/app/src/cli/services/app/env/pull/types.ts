import {appEnvShowJsonOutputSchema} from '../show/types.js'
import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

export const appEnvPullJsonOutputSchema = defineJsonOutputSchema({
  name: 'AppEnvPullResult',
  schema: zod.object({
    path: zod.string(),
    status: zod.enum(['created', 'updated', 'unchanged']),
    variables: appEnvShowJsonOutputSchema.schema,
    content: zod.string(),
  }),
  definitions: {EnvironmentVariables: appEnvShowJsonOutputSchema.schema},
})

export type AppEnvPullResult = InferJsonOutputSchema<typeof appEnvPullJsonOutputSchema>
