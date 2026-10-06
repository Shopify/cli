import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const appEnvironmentVariableSchema = zod
  .object({
    name: zod.string().min(1).describe('The environment variable name with its original spelling.'),
    value: zod.string().optional().describe('The value, included only when known.'),
    isSecret: zod.boolean().optional().describe('Whether the value is secret, included only when known.'),
    id: zod.string().min(1).optional().describe('The upstream variable identifier, included only when known.'),
    readOnly: zod.boolean().optional().describe('Whether the variable is read-only, included only when known.'),
  })
  .strict()

export const appEnvShowJsonOutputSchema = defineJsonOutputSchema({
  name: 'AppEnvShowResult',
  schema: zod.object({variables: zod.array(appEnvironmentVariableSchema)}).strict(),
  definitions: {AppEnvironmentVariable: appEnvironmentVariableSchema},
})

export type AppEnvShowResult = InferJsonOutputSchema<typeof appEnvShowJsonOutputSchema>
