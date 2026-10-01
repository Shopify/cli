import {itemToString, unstyled} from '@shopify/cli-kit/node/output'
import {
  defineJsonOutputSchema,
  jsonOutputTimestampSchema,
  type InferJsonOutputSchema,
} from '@shopify/cli-kit/node/json-output-schema'
import {jsonErrorOutputSchema} from '@shopify/cli-kit/node/error/schema'
import {zod} from '@shopify/cli-kit/node/schema'
import type {SecuritySubmitResult} from './security-submit-result.js'
import type {JsonErrorDocument} from '@shopify/cli-kit/node/error/types'

const SecuritySubmitPayloadSchema = zod
  .object({
    path: zod.string().describe('The absolute path of the native submission artifact.'),
    schemaVersion: zod.number().int().nonnegative().describe('The independently versioned submission artifact format.'),
  })
  .strict()
const SecuritySubmitSuccessSchema = zod
  .object({
    status: zod.literal('success'),
    operation: zod.literal('submit'),
    dryRun: zod.boolean(),
    payload: SecuritySubmitPayloadSchema,
  })
  .strict()

export const securitySubmitJsonOutputSchema = defineJsonOutputSchema({
  name: 'SecuritySubmitResult',
  schema: zod.union([
    SecuritySubmitSuccessSchema.extend({dryRun: zod.literal(true)}),
    SecuritySubmitSuccessSchema.extend({
      dryRun: zod.literal(false),
      submittedAt: jsonOutputTimestampSchema,
      clientId: zod.string(),
    }),
    zod.object({status: zod.literal('cancelled'), operation: zod.literal('submit')}).strict(),
  ]),
  definitions: {SecuritySubmitPayload: SecuritySubmitPayloadSchema},
})

type SecuritySubmitJsonResult = InferJsonOutputSchema<typeof securitySubmitJsonOutputSchema> | JsonErrorDocument

export function toSecuritySubmitJson(result: SecuritySubmitResult): SecuritySubmitJsonResult {
  if (result.status === 'failed') {
    return {
      error: {
        type: 'abort',
        message: result.error.message,
        ...(result.error.tryMessage === undefined || result.error.tryMessage === null
          ? {}
          : {tryMessage: unstyled(itemToString(result.error.tryMessage))}),
        ...(result.error.nextSteps === undefined
          ? {}
          : {nextSteps: result.error.nextSteps.map((step) => unstyled(itemToString(step)))}),
        details: {
          stage: result.error.stage,
          ...(result.error.userErrors === undefined ? {} : {userErrors: result.error.userErrors}),
          ...(result.error.accepted === undefined ? {} : {accepted: result.error.accepted}),
        },
      },
    }
  }

  if (result.status === 'cancelled') return {status: 'cancelled', operation: 'submit'}

  const payload = {path: result.payload.path, schemaVersion: result.payload.schemaVersion}
  if (result.status === 'dry-run') return {status: 'success', operation: 'submit', dryRun: true, payload}
  return {
    status: 'success',
    operation: 'submit',
    dryRun: false,
    payload,
    submittedAt: new Date(result.submittedAt).toISOString(),
    clientId: result.clientId,
  }
}

export function encodeSecuritySubmitJson(result: SecuritySubmitJsonResult): string {
  return 'error' in result ? jsonErrorOutputSchema.encode(result) : securitySubmitJsonOutputSchema.encode(result)
}
