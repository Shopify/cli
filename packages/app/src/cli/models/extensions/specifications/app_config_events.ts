import {transformToEventsConfig, transformFromEventsConfig} from './transform/app_config_events.js'
import {CustomTransformationConfig, createConfigExtensionSpecification} from '../specification.js'
import {BaseSchemaWithHandle, BaseSchemaWithoutHandle} from '../schemas.js'
import {Flag} from '../../../utilities/developer-platform-client.js'
import {zod} from '@shopify/cli-kit/node/schema'

export const EventsSpecIdentifier = 'events'

const EventsTransformConfig: CustomTransformationConfig = {
  forward: transformFromEventsConfig,
  reverse: transformToEventsConfig,
}

const SingleSubscriptionSchema = zod
  .object({
    handle: BaseSchemaWithHandle.shape.handle.refine(
      (handle) => handle !== EventsSpecIdentifier,
      'The handle "events" is reserved for the legacy events module. Choose a different subscription handle.',
    ),
  })
  .passthrough()

const SubscriptionSchema = zod.unknown().transform((subscription, context) => {
  if (Array.isArray(subscription)) return subscription as unknown[]

  const result = SingleSubscriptionSchema.safeParse(subscription)
  if (!result.success) {
    result.error.issues.forEach((issue) => context.addIssue(issue))
    return zod.NEVER
  }
  return result.data
})

const EventsSchema = BaseSchemaWithoutHandle.extend({
  events: zod
    .object({
      subscription: SubscriptionSchema.optional(),
    })
    .passthrough()
    .optional(),
})

const appEventsSpec = createConfigExtensionSpecification({
  identifier: EventsSpecIdentifier,
  schema: EventsSchema,
  transformConfig: EventsTransformConfig,
  expandConfig: (config, {flags}) => {
    const subscriptions = config.events?.subscription
    if (!flags.includes(Flag.SingleSubscriptionEventsModules) || !Array.isArray(subscriptions)) return [config]

    return subscriptions.map((subscription) => ({events: {...config.events, subscription}}))
  },
  getIdentity: (config) => {
    const subscription = config.events?.subscription
    if (!subscription || Array.isArray(subscription)) return undefined
    return {handle: subscription.handle, uid: subscription.handle}
  },
  // A single-subscription module targets its topic. The topic stays in the config as
  // well: Core still derives the module target from `events.subscription.topic`.
  getTarget: (config) => {
    const subscription = config.events?.subscription
    if (!subscription || Array.isArray(subscription)) return undefined
    return typeof subscription.topic === 'string' ? subscription.topic : undefined
  },
})

export default appEventsSpec
