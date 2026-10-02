import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

// Keep field order aligned with the existing validation JSON producer.
const validationIssueSchema = zod.object({
  file: zod.string().optional(),
  message: zod.string(),
  path: zod.array(zod.union([zod.string(), zod.number()])).optional(),
  code: zod.string().optional(),
})

export const appConfigValidateJsonOutputSchema = defineJsonOutputSchema({
  name: 'AppConfigValidateResult',
  schema: zod.object({valid: zod.boolean(), issues: zod.array(validationIssueSchema)}),
  definitions: {ValidationIssue: validationIssueSchema},
})

export type AppConfigValidateResult = InferJsonOutputSchema<typeof appConfigValidateJsonOutputSchema>
