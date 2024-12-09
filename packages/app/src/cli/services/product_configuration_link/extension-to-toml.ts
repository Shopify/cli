import {MAX_EXTENSION_HANDLE_LENGTH} from '../../models/extensions/schemas.js'
import {ExtensionRegistration} from '../../api/graphql/all_app_extension_registrations.js'
import {encodeToml} from '@shopify/cli-kit/node/toml'
import {slugify} from '@shopify/cli-kit/common/string'

export interface ProductConfigurationLinkDashboardConfig {
  pattern: string
}

/**
 * Given a dashboard-built product configuration link extension config file, convert it to toml for the CLI extension
 */
export function buildTomlObject(extension: ExtensionRegistration): string {
  const versionConfig = extension.activeVersion?.config ?? extension.draftVersion?.config
  if (!versionConfig) throw new Error('No config found for extension')
  const config: ProductConfigurationLinkDashboardConfig = JSON.parse(versionConfig)

  const localExtensionRepresentation = {
    extensions: [
      {
        type: 'product_configuration_link_extension',
        name: extension.title,
        handle: slugify(extension.title.substring(0, MAX_EXTENSION_HANDLE_LENGTH)),
        pattern: config.pattern,
      },
    ],
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return encodeToml(localExtensionRepresentation as any)
}
