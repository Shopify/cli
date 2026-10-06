import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'
import {isAbsolutePath} from '@shopify/cli-kit/node/path'

const validationIssueSchema = zod
  .object({
    filePath: zod.string().refine(isAbsolutePath, 'Expected an absolute filesystem path.').nullable(),
    message: zod.string(),
    fieldPath: zod.array(zod.union([zod.string(), zod.number().int().nonnegative()])).nullable(),
    code: zod.string().nullable().describe('The upstream validation code, or null when unavailable.'),
  })
  .strict()

export const appConfigValidateJsonOutputSchema = defineJsonOutputSchema({
  name: 'AppConfigValidateResult',
  schema: zod.object({valid: zod.boolean(), issues: zod.array(validationIssueSchema)}).strict(),
  definitions: {ValidationIssue: validationIssueSchema},
})

export type AppConfigValidateResult = InferJsonOutputSchema<typeof appConfigValidateJsonOutputSchema>
