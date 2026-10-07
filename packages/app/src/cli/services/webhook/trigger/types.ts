import {UserErrors} from '../request-sample.js'
import {defineJsonOutputSchema, type InferJsonOutputSchema} from '@shopify/cli-kit/node/json-output-schema'
import {zod} from '@shopify/cli-kit/node/schema'

const deliverySchema = zod
  .object({
    topic: zod.string(),
    apiVersion: zod.string(),
    deliveryMethod: zod.enum(['localhost', 'http', 'google-pub-sub', 'event-bridge']),
    address: zod.string(),
    status: zod.enum(['delivered', 'enqueued']).describe('Remote delivery is enqueued, not confirmed received.'),
  })
  .strict()

export const appWebhookTriggerJsonOutputSchema = defineJsonOutputSchema({
  name: 'AppWebhookTriggerResult',
  schema: zod.object({status: zod.literal('success'), delivery: deliverySchema}).strict(),
  definitions: {AppWebhookDelivery: deliverySchema},
})

export type AppWebhookTriggerResult = InferJsonOutputSchema<typeof appWebhookTriggerJsonOutputSchema>

export type WebhookTriggerResult =
  | (AppWebhookTriggerResult & {samplePayloadIsEmpty: boolean})
  | {status: 'failed'; reason: 'sample-request'; userErrors: UserErrors[]}
  | {status: 'failed'; reason: 'localhost-delivery'}
