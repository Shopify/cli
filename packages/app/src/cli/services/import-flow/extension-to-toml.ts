import {ExtensionRegistration} from '../../api/graphql/all_app_extension_registrations.js'
import {encodeToml} from '@shopify/cli-kit/node/toml'

interface FlowConfig {
  title: string
  description: string
  url: string
  fields?: {
    id: string
    name: string
    label: string
    description?: string
    required: boolean
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
export function buildTomlObject(extension: ExtensionRegistration) {
  const versionConfig = extension.activeVersion?.config ?? extension.draftVersion?.config
  if (!versionConfig) throw new Error('No config found for extension')
  const config: FlowConfig = JSON.parse(versionConfig)

  // Remote config uses uiType, local config uses ui_type
  const fields = config.fields?.map((field) => {
    return {
      key: field.name,
      name: field.label,
      description: field.description,
      required: field.required,
      type: field.uiType,
    }
  })

  const jsonObject = {
    name: extension.title,
    type: extension.type.replace('_definition', ''),
    description: config.description,
    extensions: [
      {
        type: extension.type.replace('_definition', ''),
        description: config.description,
        runtime_url: config.url,
        config_page_url: config.custom_configuration_page_url,
        config_page_preview_url: config.custom_configuration_page_preview_url,
        validation_url: config.validation_url,
      },
    ],
    settings: (fields?.length ?? 0) > 0 ? {fields} : undefined,
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tomlaa = encodeToml(jsonObject as any)
  console.log(tomlaa)
  return tomlaa
}
