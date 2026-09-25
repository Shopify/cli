import {
  transformToEventsConfig,
  transformFromEventsConfig,
  eventSubscriptionHandle,
} from './transform/app_config_events.js'
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
  reverse: (content: object) => transformToEventsConfig(content),
}

const EventsSchema = BaseSchemaWithoutHandle.extend({
  events: zod.any().optional(),
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
    if (parsed.state !== 'ok' || !isObject) return parsed
    const parsedSubscription = getPathValue<Record<string, unknown>>(parsed.data, 'events.subscription')
    if (!parsedSubscription) return parsed

    // Core forbids nested object handles. Its parser already supports first-class module identity.
    const {handle, ...fields} = parsedSubscription
    return {
      ...parsed,
      data: {
        ...parsed.data,
        handle: eventSubscriptionHandle(handle),
        events: {...getPathValue<object>(parsed.data, 'events'), subscription: fields},
      },
    }
  },
}

export default appEventsSpec
