import {appEnvironmentVariableSchema} from '../show/types.js'
import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {isAbsolutePath} from '@shopify/cli-kit/node/path'
import {zod} from '@shopify/cli-kit/node/schema'

export const appEnvPullJsonOutputSchema = defineJsonOutputSchema({
  name: 'AppEnvPullResult',
  schema: zod
    .object({
      path: zod
        .string()
        .refine(isAbsolutePath, 'Expected an absolute path')
        .describe('The absolute native dotenv file path.'),
      status: zod.literal('success'),
      changed: zod.boolean().describe('Whether the dotenv file was created or updated.'),
      variables: zod
        .array(appEnvironmentVariableSchema)
        .describe('The known app variables, not unrelated local variables.'),
      content: zod.string().describe('The complete native dotenv content, preserving existing variables and comments.'),
    })
    .strict(),
  definitions: {AppEnvironmentVariable: appEnvironmentVariableSchema},
})

export type AppEnvPullResult = InferJsonOutputSchema<typeof appEnvPullJsonOutputSchema>
