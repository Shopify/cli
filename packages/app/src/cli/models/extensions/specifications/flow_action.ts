import {BaseSchemaWithHandle} from '../schemas.js'
import {createExtensionSpecification} from '../specification.js'
import {
  validateFieldShape,
  validateFlowActionUrl,
  validateCustomConfigurationPageConfig,
  validateReturnTypeConfig,
} from '../../../services/flow/validation.js'
import {serializeFields} from '../../../services/flow/serialize-fields.js'
import {loadSchemaFromPath, resolveFlowActionUrl} from '../../../services/flow/utils.js'
import {zod} from '@shopify/cli-kit/node/schema'

const RELATIVE_URL_FIELDS = ['runtime_url', 'validation_url', 'config_page_url', 'config_page_preview_url'] as const

const FlowActionExtensionSchema = BaseSchemaWithHandle.extend({
  type: zod.literal('flow_action'),
  name: zod.string(),
  runtime_url: validateFlowActionUrl(zod.string({invalid_type_error: 'Value must be string'})),
  validation_url: validateFlowActionUrl(zod.string({invalid_type_error: 'Value must be string'})).optional(),
  config_page_url: validateFlowActionUrl(zod.string({invalid_type_error: 'Value must be string'})).optional(),
  config_page_preview_url: validateFlowActionUrl(zod.string({invalid_type_error: 'Value must be string'})).optional(),
  schema: zod.string().optional(),
  return_type_ref: zod.string().optional(),
}).refine((config) => {
  const configurationPageIsValid = validateCustomConfigurationPageConfig(
    config.config_page_url,
    config.config_page_preview_url,
    config.validation_url,
  )
  const fields = config.settings?.fields ?? []
  const settingsFieldsAreValid = fields.every((field, index) =>
    validateFieldShape(field, 'flow_action', config.handle, index),
  )
  const returnTypeIsValid = validateReturnTypeConfig(config.return_type_ref, config.schema)

  return configurationPageIsValid && settingsFieldsAreValid && returnTypeIsValid
})

/**
 * Extension specification with all properties and methods needed to load a Flow Action.
 */
const flowActionSpecification = createExtensionSpecification({
  identifier: 'flow_action',
  schema: FlowActionExtensionSchema,
  // Flow doesn't have anything to bundle but we need to set this to true to
  // ensure that the extension configuration is uploaded after registration in
  // https://github.com/Shopify/cli/blob/73ac91c0f40be0a57d1b18cb34254b12d3a071af/packages/app/src/cli/services/deploy.ts#L107
  // Should be removed after unified deployment is 100% rolled out
  appModuleFeatures: (_) => [],
  /**
   * During `app dev`, swap any relative URLs (starting with `/`) for the dev
   * tunnel URL the CLI assigned. This lets developers write
   * `runtime_url = "/api/execute"` in their TOML and have it resolved against
   * the tunnel automatically — the same pattern app_proxy, webhooks, and
   * events subscriptions already use.
   *
   */
  patchWithAppDevURLs: (config, urls) => {
    for (const key of RELATIVE_URL_FIELDS) {
      const value = config[key]
      if (typeof value === 'string' && value.startsWith('/')) {
        config[key] = resolveFlowActionUrl(key, value, urls.applicationUrl) ?? ''
      }
    }
  },
  deployConfig: async (config, extensionPath, _apiKey, _moduleId, context) => {
    const appConfiguration = context?.appConfiguration
    const appUrl = typeof appConfiguration?.application_url === 'string' ? appConfiguration.application_url : undefined

    return {
      title: config.name,
      description: config.description,
      url: resolveFlowActionUrl('runtime_url', config.runtime_url, appUrl),
      fields: serializeFields('flow_action', config.settings?.fields),
      validation_url: resolveFlowActionUrl('validation_url', config.validation_url, appUrl),
      custom_configuration_page_url: resolveFlowActionUrl('config_page_url', config.config_page_url, appUrl),
      custom_configuration_page_preview_url: resolveFlowActionUrl(
        'config_page_preview_url',
        config.config_page_preview_url,
        appUrl,
      ),
      schema_patch: await loadSchemaFromPath(extensionPath, config.schema),
      return_type_ref: config.return_type_ref,
    }
  },
})

export default flowActionSpecification
