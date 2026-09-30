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

const ModuleHandleSchema = BaseSchemaWithHandle.shape.handle.refine(
  (handle) => handle !== EventsSpecIdentifier,
  'The handle "events" is reserved for the legacy events module. Choose a different subscription handle.',
)

const EventsSectionSchema = zod
  .object({
    subscription: zod.unknown().optional(),
  })
  .passthrough()

// A single-subscription module keeps its handle on the module, like every other module, so the
// nested subscription matches the platform contract. A subscription list keeps handles on each entry.
const EventsSchema = BaseSchemaWithoutHandle.extend({
  handle: ModuleHandleSchema.optional(),
  events: EventsSectionSchema.optional(),
}).superRefine((config, context) => {
  const subscription = config.events?.subscription
  if (subscription === undefined || Array.isArray(subscription)) return

  const result = ModuleHandleSchema.safeParse(config.handle)
  if (result.success) return
  result.error.issues.forEach((issue) => context.addIssue({...issue, path: ['handle']}))
})

function isSingleSubscription(config: zod.infer<typeof EventsSchema>): config is typeof config & {handle: string} {
  const subscription = config.events?.subscription
  return subscription !== undefined && !Array.isArray(subscription) && typeof config.handle === 'string'
}

const appEventsSpec = createConfigExtensionSpecification({
  identifier: EventsSpecIdentifier,
  schema: EventsSchema,
  transformConfig: EventsTransformConfig,
  expandConfig: (config, {flags}) => {
    const subscriptions = config.events?.subscription
    if (!flags.includes(Flag.SingleSubscriptionEventsModules) || !Array.isArray(subscriptions)) return [config]

    return subscriptions.map((entry) => {
      const {handle, ...subscription} = entry as {handle?: unknown; [key: string]: unknown}
      return {handle, events: {...config.events, subscription}}
    })
  },
  getIdentity: (config) => {
    if (!isSingleSubscription(config)) return undefined
    return {handle: config.handle, uid: config.handle}
  },
  // A single-subscription module targets its topic. The topic stays in the config as
  // well: Core still derives the module target from `events.subscription.topic`.
  getTarget: (config) => {
    if (!isSingleSubscription(config)) return undefined
    const topic = (config.events?.subscription as {topic?: unknown}).topic
    return typeof topic === 'string' ? topic : undefined
  },
})

export default appEventsSpec
