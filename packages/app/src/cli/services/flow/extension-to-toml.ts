import {configFromSerializedFields} from './serialize-partners-fields.js'
import {FlowPartnersExtensionTypes} from './types.js'
import {ExtensionRegistration} from '../../api/graphql/all_app_extension_registrations.js'
import {MAX_EXTENSION_HANDLE_LENGTH} from '../../models/extensions/schemas.js'
import {encodeToml} from '@shopify/cli-kit/node/toml'
import {slugify} from '@shopify/cli-kit/common/string'

// Used for importing flow_action_definition and flow_trigger_definition migrating them to flow_action and flow_trigger
interface FlowConfig {
  title: string
  description: string
  url: string
  fields?: {
    id: string
    name: string
    label?: string
    description?: string
    required?: boolean
    uiType: string
  }[]
  custom_configuration_page_url?: string
  custom_configuration_page_preview_url?: string
  validation_url?: string
}

// Used for importing flow_trigger_discovery_webhook and migrating to flow_trigger_lifecycle_callback
interface FlowWebhookConfig {
  url: string
}

/**
 * Given a flow extension config file, convert it to toml
 * Works for both trigger and action because trigger config is a subset of action config
 */
export function buildTomlObject(extension: ExtensionRegistration): string {
  const versionConfig = extension.activeVersion?.config ?? extension.draftVersion?.config
  if (!versionConfig) throw new Error('No config found for extension')

  const defaultURL = extension.type === 'flow_action_definition' ? 'https://url.com/api/execute' : undefined

  let localExtensionRepresentation

  if (extension.type === 'flow_trigger_discovery_webhook') {
    const config: FlowWebhookConfig = JSON.parse(versionConfig)
    localExtensionRepresentation = {
      extensions: [
        {
          type: 'flow_trigger_lifecycle_callback',
          name: extension.title,
          handle: slugify(extension.title.substring(0, MAX_EXTENSION_HANDLE_LENGTH)),
          url: config.url,
        },
      ],
    }
  } else {
    const config: FlowConfig = JSON.parse(versionConfig)
    const fields = configFromSerializedFields(extension.type as FlowPartnersExtensionTypes, config.fields ?? [])
    localExtensionRepresentation = {
      extensions: [
        {
          type: extension.type.replace('_definition', ''),
          name: config.title,
          handle: slugify(extension.title.substring(0, MAX_EXTENSION_HANDLE_LENGTH)),
          description: config.description,
          runtime_url: config.url ?? defaultURL,
          config_page_url: config.custom_configuration_page_url,
          config_page_preview_url: config.custom_configuration_page_preview_url,
          validation_url: config.validation_url,
        },
      ],
      settings: (fields?.length ?? 0) > 0 ? {fields} : undefined,
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return encodeToml(localExtensionRepresentation as any)
}
