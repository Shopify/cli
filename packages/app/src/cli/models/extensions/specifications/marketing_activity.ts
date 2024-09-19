import {MarketingActivityExtensionSchema} from './marketing_activity_schemas/marketing_activity_schema.js'
import {createExtensionSpecification} from '../specification.js'
import {randomUUID} from '@shopify/cli-kit/node/crypto'

const spec = createExtensionSpecification({
  identifier: 'marketing_activity',
  schema: MarketingActivityExtensionSchema,
  appModuleFeatures: (_) => ['bundling'],
  deployConfig: async (config, _) => {
    return {
      title: config.title,
      description: config.description,
      api_path: config.api_path,
      tactic: config.tactic,
      marketing_channel: config.marketing_channel,
      referring_domain: config.referring_domain,
      is_automation: config.is_automation,
      use_external_editor: config.use_external_editor,
      preview_data: config.preview_data,
      fields: config.fields.map((field) => ({
        ...field,
        // NOTE: we're not using this id anywhere, generating it to satisfy the schema
        // decided not to remove it from the schema for now to minimize the risk of breaking changes
        id: randomUUID(),
      })),
    }
  },
})

export default spec
