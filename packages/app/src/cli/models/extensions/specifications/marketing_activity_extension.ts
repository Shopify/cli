import {MarketingActivityExtensionSchema} from './marketing_activity_extension_schemas/marketing_activity_extension_schema.js'
import {createExtensionSpecification} from '../specification.js'

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
      marketing_channel: config.marketing_channel,
      referring_domain: config.referring_domain,
      is_automation: config.is_automation,
      use_external_editor: config.use_external_editor,
      preview_data: config.preview_data,
      fields: config.fields,
    }
  },
})

export default spec
