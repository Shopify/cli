import {createConfigExtensionSpecification} from '../specification.js'
import {zod} from '@shopify/cli-kit/node/schema'

const ChannelConfigSchema = zod.object({
  channel_config: zod
    .object({
      handle: zod.string(),
      channel_definition_handle: zod.string(),
      max_listing_variants: zod.number(),
      publication_status_listing_level: zod.enum(['item', 'listing']),
    })
    .optional(),
})

export const ChannelConfigSpecIdentifier = 'channel_config'

export default createConfigExtensionSpecification({
  identifier: ChannelConfigSpecIdentifier,
  schema: ChannelConfigSchema,
})
