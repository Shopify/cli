import {contextToTarget} from './utils.js'
import {ExtensionRegistration} from '../../api/graphql/all_app_extension_registrations.js'
import {MAX_EXTENSION_HANDLE_LENGTH} from '../../models/extensions/schemas.js'
import {CurrentAppConfiguration} from '../../models/app/app.js'
import {encodeToml} from '@shopify/cli-kit/node/toml'
import {slugify} from '@shopify/cli-kit/common/string'

interface AdminLinkConfig {
  text: string
  url: string
}

/**
 * Given an app_link or bulk_action extension config file, convert it to toml
 */
export function buildTomlObject(
  extension: ExtensionRegistration,
  _: ExtensionRegistration[],
  appConfiguration: CurrentAppConfiguration,
): string {
  const versionConfig = extension.activeVersion?.config ?? extension.draftVersion?.config
  if (!versionConfig) throw new Error('No config found for extension')

  const context = extension.activeVersion?.context ?? extension.draftVersion?.context
  if (!context) throw new Error('No context found for link extension')

  const config: AdminLinkConfig = JSON.parse(versionConfig)

  if (appConfiguration.embedded) {
    try {
      const linkUrl = new URL(config.url)
      const linkPath = linkUrl.pathname.startsWith('/') ? linkUrl.pathname.substring(1) : linkUrl.pathname
      const fullUrl = new URL(`app://${linkPath}`)
      fullUrl.search = linkUrl.search
      fullUrl.hash = linkUrl.hash
      config.url = fullUrl.toString()
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      // Keep original URL if parsing fails
    }
  }

  const localExtensionRepresentation = {
    extensions: [
      {
        type: 'admin_link',
        name: extension.title,
        handle: slugify(extension.title.substring(0, MAX_EXTENSION_HANDLE_LENGTH)),
        targeting: [
          {
            text: config.text,
            url: config.url,
            target: contextToTarget(context),
          },
        ],
      },
    ],
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return encodeToml(localExtensionRepresentation as any)
}
