import {ExtensionRegistration} from '../../api/graphql/all_app_extension_registrations.js'
import {MAX_EXTENSION_HANDLE_LENGTH} from '../../models/extensions/schemas.js'
import {encodeToml} from '@shopify/cli-kit/node/toml'
import {slugify} from '@shopify/cli-kit/common/string'

interface ChannelConfigExtensionConfig {
  channel_definition_handle: string
  max_listing_variants: number
  publication_status_listing_level: string
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
        channel_definition_handle: config.channel_definition_handle,
        max_listing_variants: config.max_listing_variants,
        publication_status_listing_level: config.publication_status_listing_level,
      },
    ],
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return encodeToml(localExtensionRepresentation as any)
}
