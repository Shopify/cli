import {MAX_EXTENSION_HANDLE_LENGTH} from '../../models/extensions/schemas.js'
import {ExtensionRegistration} from '../../api/graphql/all_app_extension_registrations.js'
import {slugify} from '@shopify/cli-kit/common/string'

export interface SubscriptionLinkDashboardConfig {
  pattern: string
}

/**
 * Given a dashboard-built subscription link extension config file, convert it to toml for the CLI extension
 */
export function buildExtensionConfig(extension: ExtensionRegistration): object {
  const versionConfig = extension.activeVersion?.config ?? extension.draftVersion?.config
  if (!versionConfig) throw new Error('No config found for extension')
  const config: SubscriptionLinkDashboardConfig = JSON.parse(versionConfig)

  const localExtensionRepresentation = {
    extensions: [
      {
        type: 'subscription_link_extension',
        name: extension.title,
        handle: slugify(extension.title.substring(0, MAX_EXTENSION_HANDLE_LENGTH)),
        pattern: config.pattern,
      },
    ],
  }
  return localExtensionRepresentation
}
