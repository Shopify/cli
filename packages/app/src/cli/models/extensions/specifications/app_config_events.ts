import {transformToEventsConfig, transformFromEventsConfig} from './transform/app_config_events.js'
import {EventSubscriptionHandleSchema} from './validation/events.js'
import {
  CustomTransformationConfig,
  ExtensionSpecification,
  createConfigExtensionSpecification,
} from '../specification.js'
import {BaseSchemaWithoutHandle} from '../schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'
import {getPathValue} from '@shopify/cli-kit/common/object'

export const EventsSpecIdentifier = 'events'

const EventsTransformConfig: CustomTransformationConfig = {
  forward: transformFromEventsConfig,
  reverse: transformToEventsConfig,
}

const SubscriptionSchema = zod.object({handle: EventSubscriptionHandleSchema}).passthrough()
const SubscriptionListSchema = SubscriptionSchema.array().superRefine((subscriptions, context) => {
  const handles = new Set<string>()
  subscriptions.forEach((subscription, index) => {
    const handle = subscription.handle.toLowerCase()
    if (handles.has(handle)) {
      context.addIssue({
        code: zod.ZodIssueCode.custom,
        path: [index, 'handle'],
        message: `Duplicated handle "${subscription.handle}" in events subscriptions (case-insensitive).`,
      })
    }
    handles.add(handle)
  })
})

const EventsSchema = BaseSchemaWithoutHandle.extend({
  events: zod
    .object({subscription: zod.union([SubscriptionSchema, SubscriptionListSchema]).nullish()})
    .passthrough()
    .nullish(),
})

const baseSpec = createConfigExtensionSpecification({
  identifier: EventsSpecIdentifier,
  schema: EventsSchema,
  transformConfig: EventsTransformConfig,
})

const appEventsSpec: ExtensionSpecification = {
  ...baseSpec,
  parseConfigurationObject(configurationObject: object) {
    const events = getPathValue<Record<string, unknown>>(configurationObject, 'events')
    const subscription = events?.subscription
    const isObject = subscription !== null && typeof subscription === 'object' && !Array.isArray(subscription)
    // The loader parses extension configs again. Rebuild an editing copy for the unchanged local schema.
    const editingConfig = isObject
      ? {
          ...configurationObject,
          events: {
            ...events,
            subscription: {handle: getPathValue(configurationObject, 'handle'), ...subscription},
          },
        }
      : configurationObject
    const parsed = baseSpec.parseConfigurationObject(editingConfig)
    if (parsed.state !== 'ok') return parsed
    const parsedEvents = parsed.data.events
    const parsedSubscription = parsedEvents?.subscription
    if (!parsedSubscription || Array.isArray(parsedSubscription)) return parsed

    // Core forbids nested object handles; the CLI contract parser already accepts first-class identity.
    const {handle, ...fields} = parsedSubscription
    return {...parsed, data: {...parsed.data, handle, events: {...parsedEvents, subscription: fields}}}
  },
}

export default appEventsSpec
