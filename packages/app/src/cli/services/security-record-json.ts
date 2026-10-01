import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

// Only a recorded document is a result. A rejected document is an AbortError whose
// `details.errors` lists every validation error. The recorded artifact itself isn't echoed:
// it's already in agent-findings.json and can be up to 5 MB.
export const securityRecordJsonOutputSchema = defineJsonOutputSchema({
  name: 'AppSecurityRecordResult',
  schema: zod.object({
    path: zod.string(),
    checks: zod.number().int(),
    findings: zod.number().int(),
  }),
})

export type SecurityRecordResult = InferJsonOutputSchema<typeof securityRecordJsonOutputSchema>
