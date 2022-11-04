import {getLocalization} from './localization.js'
import {UIExtensionPayload} from './payload/models.js'
import {getUIExtensionResourceURL, getUIExtensionSurface} from '../../../utilities/extensions/configuration.js'
import {ExtensionDevOptions} from '../extension.js'
import {ExtensionInstance} from '../../../models/extensions/extensions.js'
import {getDependencyVersion} from '../../../models/app/app.js'
import {file} from '@shopify/cli-kit'

type GetUIExtensionPayloadOptions = ExtensionDevOptions & {
  currentDevelopmentPayload?: Partial<UIExtensionPayload['development']>
  currentLocalizationPayload?: UIExtensionPayload['localization']
}

export async function getUIExtensionPayload(
  extension: ExtensionInstance,
  options: GetUIExtensionPayloadOptions,
): Promise<UIExtensionPayload> {
  const url = `${options.url}/extensions/${extension.devUUID}`
  const {localization, status: localizationStatus} = await getLocalization(
    extension,
    options.currentLocalizationPayload,
  )

  const renderer = await getDependencyVersion(extension.dependency?.name ?? '', extension.directory)
  return {
    assets: {
      main: {
        name: 'main',
        url: `${url}/assets/main.js`,
        lastUpdated: (await file.lastUpdatedTimestamp(extension.outputPath)) ?? 0,
      },
    },
    capabilities: {
      blockProgress: extension.configuration.capabilities?.block_progress || false,
      networkAccess: extension.configuration.capabilities?.network_access || false,
    },
    development: {
      ...options.currentDevelopmentPayload,
      resource: getUIExtensionResourceURL(extension.type, options),
      root: {
        url,
      },

      hidden: options.currentDevelopmentPayload?.hidden || false,
      localizationStatus,
      status: options.currentDevelopmentPayload?.status || 'success',
      ...(options.currentDevelopmentPayload || {status: 'success'}),
    },
    extensionPoints: extension.configuration.extension_points?.map((point) => point.type) ?? null,
    localization: localization ?? null,
    categories: extension.configuration.categories ?? null,
    metafields: extension.configuration.metafields?.length === 0 ? null : extension.configuration.metafields,
    type: extension.type,

    externalType: extension.externalType,
    uuid: extension.devUUID,

    surface: getUIExtensionSurface(extension.type),

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    version: renderer?.version,

    title: extension.configuration.name,
    approvalScopes: options.grantedScopes,
  }
}
