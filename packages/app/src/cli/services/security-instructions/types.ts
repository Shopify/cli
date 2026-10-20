import {
  appSecurityAppSchema,
  appSecurityInstructionsSchema,
  createAbsolutePathSchema,
} from '../app-security-json-output.js'
import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

/** With --write, the result is only the written file. */
const appSecurityInstructionsFileSchema = zod
  .object({
    path: createAbsolutePathSchema().describe('The absolute path of the file that the instructions were written to.'),
    format: zod.literal('markdown').describe('The file holds the instructions in Markdown, not a JSON result.'),
  })
  .strict()

export const appSecurityInstructionsJsonOutputSchema = defineJsonOutputSchema({
  name: 'AppSecurityInstructionsResult',
  schema: zod
    .union([
      zod
        .object({
          status: zod.literal('success'),
          app: appSecurityAppSchema,
          resultsDirectory: createAbsolutePathSchema().describe(
            'The absolute path of the results directory that the instructions use. It may not exist yet: the instructions start by running check, which creates it.',
          ),
          instructions: appSecurityInstructionsSchema,
        })
        .strict(),
      appSecurityInstructionsFileSchema,
    ])
    .describe('The instructions and the app they are for. With --write, only the file they were written to.'),
  definitions: {
    AppSecurityApp: appSecurityAppSchema,
    AppSecurityInstructions: appSecurityInstructionsSchema,
    AppSecurityInstructionsFile: appSecurityInstructionsFileSchema,
  },
})

export type AppSecurityInstructionsResult = InferJsonOutputSchema<typeof appSecurityInstructionsJsonOutputSchema>
