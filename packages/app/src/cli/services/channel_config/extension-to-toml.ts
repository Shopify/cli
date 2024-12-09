import {ExtensionRegistration} from '../../api/graphql/all_app_extension_registrations.js'
import {MAX_EXTENSION_HANDLE_LENGTH} from '../../models/extensions/schemas.js'
import {encodeToml} from '@shopify/cli-kit/node/toml'
import {slugify} from '@shopify/cli-kit/common/string'

interface ChannelConfigExtensionConfig {
  channel_definition_handle: string
  max_listing_variants: number
  publication_status_listing_level: string
  channel_configs: {
    handle: string
    channel_definition_handle: string
    max_listing_variants: number
    publication_status_level: string
    markets: {
      handle: string
      taxonomy_name: string
      taxonomy_id: number
      product_schema: string
      languages: string[]
    }[]
  }[]
  product_schema: {
    handle: string
    schema_fields: {
      handle: string
      resource_type: string
      default_source_path: string
      required_data_type: string
      enforcement: string
      can_overwrite: boolean
      display: {
        display_name: string
        display_domain: string
        display_order: number
      }
    }[]
  }[]
}

/**
 * Given a channel_config extension config file, convert it to toml
 */
export function buildTomlObject(extension: ExtensionRegistration): string {
  const versionConfig = extension.activeVersion?.config ?? extension.draftVersion?.config
  if (!versionConfig) throw new Error('No config found for extension')
  const config: ChannelConfigExtensionConfig = JSON.parse(versionConfig)

  const localExtensionRepresentation = {
    extensions: [
      {
        type: 'channel_config',
        name: extension.title,
        handle: slugify(extension.title.substring(0, MAX_EXTENSION_HANDLE_LENGTH)),
        channel_configs: config.channel_configs,
        product_schema: config.product_schema,
      },
    ],
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return encodeToml(localExtensionRepresentation as any)
}
