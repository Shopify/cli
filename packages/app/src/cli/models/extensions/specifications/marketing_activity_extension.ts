import {createExtensionSpecification} from '../specification.js'
import {BaseSchema} from '../schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'

const MarketingActivityExtensionSchema = BaseSchema.extend({
  title: zod.string().min(1),
  description: zod.string().min(1),
  app_api_url: zod.string(),
  tactic: zod.enum([
    'ad,',
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
  platform: zod.string().optional(),
  ad_format: zod.string().optional(),
  is_automation: zod.boolean().optional(),
  is_automation_step: zod.boolean().optional(),
  use_external_editor: zod.boolean().optional(),
  enable_pricing_confirmation: zod.boolean().optional(),
  pricing_information: zod.string().optional(),
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
      platform: config.platform,
      ad_format: config.ad_format,
      is_automation: config.is_automation,
      is_automation_step: config.is_automation_step,
      use_external_editor: config.use_external_editor,
      enable_pricing_confirmation: config.enable_pricing_confirmation,
      pricing_information: config.pricing_information,
      preview_data: config.preview_data,
      fields: config.fields,
    }
  },
})

export default spec
