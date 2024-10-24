import {contextToTarget} from './utils.js'
import {ExtensionRegistration} from '../../api/graphql/all_app_extension_registrations.js'
import {MAX_EXTENSION_HANDLE_LENGTH} from '../../models/extensions/schemas.js'
import {encodeToml} from '@shopify/cli-kit/node/toml'
import {slugify} from '@shopify/cli-kit/common/string'

interface AdminLinkConfig {
  text: string
  url: string
}

/**
 * Given an app_link or bulk_action extension config file, convert it to toml
 */
export function buildTomlObject(extension: ExtensionRegistration): string {
  const versionConfig = extension.activeVersion?.config ?? extension.draftVersion?.config
  if (!versionConfig) throw new Error('No config found for extension')

  const context = extension.activeVersion?.context ?? extension.draftVersion?.context
  if (!context) throw new Error('No context found for link extension')

  const config: AdminLinkConfig = JSON.parse(versionConfig)

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
