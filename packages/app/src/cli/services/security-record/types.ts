import {appSecurityAppSchema, createAbsolutePathSchema} from '../app-security-json-output.js'
import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

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
    })
    .strict(),
  definitions: {AppSecurityApp: appSecurityAppSchema},
})

export type AppSecurityRecordResult = InferJsonOutputSchema<typeof appSecurityRecordJsonOutputSchema>
