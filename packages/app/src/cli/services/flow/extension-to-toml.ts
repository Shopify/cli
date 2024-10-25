import {configFromSerializedFields} from './serialize-partners-fields.js'
import {FlowPartnersExtensionTypes} from './types.js'
import {ExtensionRegistration} from '../../api/graphql/all_app_extension_registrations.js'
import {MAX_EXTENSION_HANDLE_LENGTH} from '../../models/extensions/schemas.js'
import {encodeToml} from '@shopify/cli-kit/node/toml'
import {slugify} from '@shopify/cli-kit/common/string'

import {renderSelectPrompt, renderInfo, renderSuccess} from '@shopify/cli-kit/node/ui'

interface FlowConfig {
  title: string
  description?: string
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

/**
 * Given a flow extension config file, convert it to toml
 * Works for both trigger and action because trigger config is a subset of action config
 */
export function buildTomlObject(extension: ExtensionRegistration): string {
  const versionConfig = extension.activeVersion?.config ?? extension.draftVersion?.config
  if (!versionConfig) throw new Error('No config found for extension')
  const config: FlowConfig = JSON.parse(versionConfig)

  const fields = configFromSerializedFields(extension.type as FlowPartnersExtensionTypes, config.fields ?? [])

  const defaultURL = extension.type === 'flow_action_definition' ? 'https://url.com/api/execute' : undefined

  let localExtensionRepresentation

  renderSuccess({headline: [`${JSON.stringify(config)}`]})
  renderSuccess({headline: [`${JSON.stringify(extension)}`]})

  if (extension.type === 'flow_trigger_discovery_webhook') {
    localExtensionRepresentation = {
      extensions: [
        {
          type: 'flow_trigger_lifecycle_callback',
          name: extension.title,
          handle: slugify(extension.title.substring(0, MAX_EXTENSION_HANDLE_LENGTH)),
          // description: config.description,
          url: config.url ?? defaultURL,
          // config_page_url: config.custom_configuration_page_url,
          // config_page_preview_url: config.custom_configuration_page_preview_url,
          // validation_url: config.validation_url,
        },
      ],
      settings: (fields?.length ?? 0) > 0 ? {fields} : undefined,
    }
  } else {
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
