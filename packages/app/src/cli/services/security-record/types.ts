import {
  appSecurityAppSchema,
  appSecuritySavedSuppressionSchema,
  createAbsolutePathSchema,
} from '../app-security/types.js'
import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const appSecurityRecordedSuppressionsSchema = zod
  .object({
    filePath: createAbsolutePathSchema().describe('The absolute path of shopify.app-security.json.'),
    entries: zod
      .array(appSecuritySavedSuppressionSchema)
      .describe("The entries that were added or extended for the agent's suppressions."),
    alreadySavedCount: zod
      .number()
      .int()
      .nonnegative()
      .describe(
        'The number of suppressions that an entry of the file already held, so the file did not change for them.',
      ),
    notSaved: zod
      .array(
        zod
          .object({
            checkId: zod.string().describe("The finding's check ID."),
            location: zod
              .object({
                filePath: createAbsolutePathSchema().describe('The absolute path of the file.'),
                line: zod.number().int().positive().nullable().describe('The one-based line, or null for none.'),
              })
              .strict()
              .describe("The finding's location."),
            message: zod.string().describe('Why no entry could be saved for the suppression.'),
          })
          .strict(),
      )
      .describe(
        "The suppressions that no entry could name alone. They're recorded in agent-findings.json, and apply to this run's findings only.",
      ),
  })
  .strict()
  .describe("How the agent's suppressions were saved to shopify.app-security.json.")

export const appSecurityRecordJsonOutputSchema = defineJsonOutputSchema({
  name: 'AppSecurityRecordResult',
  schema: zod
    .object({
      status: zod.literal('success'),
      app: appSecurityAppSchema,
      resultsDirectory: createAbsolutePathSchema().describe('The absolute path of the results directory.'),
      path: createAbsolutePathSchema().describe('The absolute path of the agent-findings.json file that was written.'),
      checkCount: zod.number().int().nonnegative().describe('The number of checks recorded.'),
      findingCount: zod.number().int().nonnegative().describe('The number of findings recorded, across every check.'),
      suppressions: appSecurityRecordedSuppressionsSchema
        .nullable()
        .describe(
          'How the suppressions in the document were saved to shopify.app-security.json, or null when no finding has a suppression.',
        ),
    })
    .strict(),
  definitions: {
    AppSecurityApp: appSecurityAppSchema,
    AppSecurityRecordedSuppressions: appSecurityRecordedSuppressionsSchema,
    AppSecuritySavedSuppression: appSecuritySavedSuppressionSchema,
  },
})

export type AppSecurityRecordResult = InferJsonOutputSchema<typeof appSecurityRecordJsonOutputSchema>
