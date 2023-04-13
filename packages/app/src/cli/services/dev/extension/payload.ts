import {getLocalization} from './localization.js'
import {DevNewExtensionPointSchema, UIExtensionPayload} from './payload/models.js'
import {getExtensionPointTargetSurface} from './utilities.js'
import {getUIExtensionResourceURL} from '../../../utilities/extensions/configuration.js'
import {ExtensionDevOptions} from '../extension.js'
import {UIExtension} from '../../../models/app/extensions.js'
import {getUIExtensionRendererVersion} from '../../../models/app/app.js'
import {fileLastUpdatedTimestamp} from '@shopify/cli-kit/node/fs'

export type GetUIExtensionPayloadOptions = ExtensionDevOptions & {
  currentDevelopmentPayload?: Partial<UIExtensionPayload['development']>
  currentLocalizationPayload?: UIExtensionPayload['localization']
}

export async function getUIExtensionPayload(
  extension: UIExtension,
  options: GetUIExtensionPayloadOptions,
): Promise<UIExtensionPayload> {
  const url = `${options.url}/extensions/${extension.devUUID}`
  const {localization, status: localizationStatus} = await getLocalization(extension, options)

  const renderer = await getUIExtensionRendererVersion(extension, options.app)
  const defaultConfig = {
    assets: {
      main: {
        name: 'main',
        url: `${url}/assets/main.js`,
        lastUpdated: (await fileLastUpdatedTimestamp(extension.outputBundlePath)) ?? 0,
      },
    },
    capabilities: {
      blockProgress: extension.configuration.capabilities?.block_progress || false,
      networkAccess: extension.configuration.capabilities?.network_access || false,
      apiAccess: extension.configuration.capabilities?.api_access || false,
    },
    development: {
      ...options.currentDevelopmentPayload,
      resource: getUIExtensionResourceURL(extension.configuration.type, options),
      root: {
        url,
      },
      hidden: options.currentDevelopmentPayload?.hidden || false,
      localizationStatus,
      status: options.currentDevelopmentPayload?.status || 'success',
      ...(options.currentDevelopmentPayload || {status: 'success'}),
    },
    extensionPoints: getExtensionPoints(extension.configuration.extensionPoints, url),
    localization: localization ?? null,
    categories: extension.configuration.categories ?? null,
    metafields: extension.configuration.metafields.length === 0 ? null : extension.configuration.metafields,
    type: extension.configuration.type,

    externalType: extension.externalType,
    uuid: extension.devUUID,

    surface: extension.surface,

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    version: renderer?.version,

    title: extension.configuration.name,
    apiVersion: extension.configuration.apiVersion,
    approvalScopes: options.grantedScopes,
  }
  return defaultConfig
}

function getExtensionPoints(extensionPoints: UIExtension['configuration']['extensionPoints'], url: string) {
  if (isNewExtensionPointsSchema(extensionPoints)) {
    return extensionPoints.map((extensionPoint) => {
      const {target, resource} = extensionPoint

      return {
        ...extensionPoint,
        surface: getExtensionPointTargetSurface(target),
        root: {
          url: `${url}/${target}`,
        },
        resource: resource || {url: ''},
      }
    })
  }

  return extensionPoints
}

export function isNewExtensionPointsSchema(extensionPoints: unknown): extensionPoints is DevNewExtensionPointSchema[] {
  return (
    Array.isArray(extensionPoints) &&
    extensionPoints.every((extensionPoint: unknown) => typeof extensionPoint === 'object')
  )
}
