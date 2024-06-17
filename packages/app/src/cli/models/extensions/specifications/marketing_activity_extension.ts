import {createExtensionSpecification} from '../specification.js'
import {BaseSchema} from '../schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'

const MarketingActivityExtensionSchema = BaseSchema.extend({
  title: zod.string().min(1),
  description: zod.string().min(1),
  app_api_url: zod.string(),
  tactic: zod.enum([
    'ad',
    'retargeting',
    'post',
    'message',
    'transactional',
    'newsletter',
    'abandoned_cart',
    'affililate',
    'loyalty',
    'link',
    'storefront_app',
  ]),
  channel: zod.enum(['social', 'search', 'email', 'sms', 'display', 'marketplace']),
  referring_domain: zod.string().optional(),
  is_automation: zod.boolean().optional(),
  use_external_editor: zod.boolean().optional(),
  preview_data: zod.object({
    types: zod
      .array(
        zod.object({
          label: zod.string(),
          value: zod.string(),
        }),
      )
      .max(3)
      .min(1),
  }),
  fields: zod.array(zod.any()),
})

const spec = createExtensionSpecification({
  identifier: 'marketing_activity_extension_cli',
  schema: MarketingActivityExtensionSchema,
  appModuleFeatures: (_) => ['bundling'],
  deployConfig: async (config, _) => {
    return {
      title: config.title,
      description: config.description,
      app_api_url: config.app_api_url,
      tactic: config.tactic,
      channel: config.channel,
      referring_domain: config.referring_domain,
      is_automation: config.is_automation,
      use_external_editor: config.use_external_editor,
      preview_data: config.preview_data,
      fields: config.fields,
    }
  },
})

export default spec
