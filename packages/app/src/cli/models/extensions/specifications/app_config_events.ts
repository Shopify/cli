import {transformToEventsConfig, transformFromEventsConfig} from './transform/app_config_events.js'
import {CustomTransformationConfig, createConfigExtensionSpecification} from '../specification.js'
import {BaseSchemaWithoutHandle} from '../schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'

export const EventsSpecIdentifier = 'events'

const EventsTransformConfig: CustomTransformationConfig = {
  forward: transformFromEventsConfig,
  reverse: (content: object) => transformToEventsConfig(content),
}

const EventsSchema = BaseSchemaWithoutHandle.extend({
  events: zod.any().optional(),
})

const appEventsSpec = createConfigExtensionSpecification({
  identifier: EventsSpecIdentifier,
  schema: EventsSchema,
  transformConfig: EventsTransformConfig,
})

export default appEventsSpec
