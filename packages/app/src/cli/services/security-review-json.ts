import {defineJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

// Review prints each artifact as stored, so only the field shared by both is described.
// This schema is deliberately loose (passthrough) until review's output is redesigned.
const storedArtifactSchema = zod.object({schema_version: zod.number()}).passthrough()

export const securityReviewJsonOutputSchema = defineJsonOutputSchema({
  name: 'AppSecurityReviewResult',
  schema: zod.object({
    deterministic_findings: storedArtifactSchema.nullable(),
    agent_findings: storedArtifactSchema.nullable(),
  }),
  definitions: {AppSecurityStoredArtifact: storedArtifactSchema},
})
