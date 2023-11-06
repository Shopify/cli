import {WebhookSubscriptionSchema} from '../../../models/app/app.js'
import {zod} from '@shopify/cli-kit/node/schema'

export type NormalizedWebhookSubscriptions = Partial<zod.infer<typeof WebhookSubscriptionSchema>>[]

// eslint-disable-next-line no-warning-comments
// TODO - remove this when mutation is ready
export function fakedWebhookSubscriptionsMutation(subscriptions: NormalizedWebhookSubscriptions) {
  return subscriptions
}
