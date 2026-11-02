import {appSecurityAppSchema, createAbsolutePathSchema} from '../app-security/types.js'
import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

/** `--all` works on the app directory alone: no app configuration or client ID is selected. */
const appSecurityCleanAllAppSchema = zod
  .object({directory: createAbsolutePathSchema().describe('The absolute app directory.')})
  .strict()

export const appSecurityCleanJsonOutputSchema = defineJsonOutputSchema({
  name: 'AppSecurityCleanResult',
  schema: zod
    .object({
      status: zod.literal('success'),
      changed: zod.boolean().describe('Whether any results directory was removed.'),
      app: zod
        .union([appSecurityAppSchema, appSecurityCleanAllAppSchema])
        .describe('The selected app. With --all, only its directory.'),
      resultsDirectories: zod
        .array(createAbsolutePathSchema())
        .describe(
          'The absolute paths of the removed results directories, sorted. Empty when there was nothing to remove.',
        ),
    })
    .strict(),
  definitions: {AppSecurityApp: appSecurityAppSchema, AppSecurityCleanAllApp: appSecurityCleanAllAppSchema},
})

export type AppSecurityCleanResult = InferJsonOutputSchema<typeof appSecurityCleanJsonOutputSchema>
