import {getLocalization} from './localization.js'
import {DevNewExtensionPointSchema, UIExtensionPayload} from './payload/models.js'
import {getExtensionPointTargetSurface} from './utilities.js'
import {getUIExtensionResourceURL} from '../../../utilities/extensions/configuration.js'
import {ExtensionDevOptions} from '../extension.js'
import {getUIExtensionRendererVersion} from '../../../models/app/app.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {fileLastUpdatedTimestamp} from '@shopify/cli-kit/node/fs'

export type GetUIExtensionPayloadOptions = ExtensionDevOptions & {
  currentDevelopmentPayload?: Partial<UIExtensionPayload['development']>
  currentLocalizationPayload?: UIExtensionPayload['localization']
}

export async function getUIExtensionPayload(
  extension: ExtensionInstance,
  options: GetUIExtensionPayloadOptions,
): Promise<UIExtensionPayload> {
  const url = `${options.url}/extensions/${extension.devUUID}`
  const {localization, status: localizationStatus} = await getLocalization(extension, options)

  const renderer = await getUIExtensionRendererVersion(extension)
  const defaultConfig = {
    assets: {
      main: {
        name: 'main',
        url: `${url}/assets/${extension.outputFileName}`,
        lastUpdated: (await fileLastUpdatedTimestamp(extension.outputPath)) ?? 0,
      },
    },
    capabilities: {
      blockProgress: extension.configuration.capabilities?.block_progress || false,
      networkAccess: extension.configuration.capabilities?.network_access || false,
      apiAccess: extension.configuration.capabilities?.api_access || false,
      collectBuyerConsent: {
        smsMarketing: extension.configuration.capabilities?.collect_buyer_consent?.sms_marketing || false,
        customerPrivacy: extension.configuration.capabilities?.collect_buyer_consent?.customer_privacy || false,
      },
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
    extensionPoints: getExtensionPoints(extension.configuration.extension_points, url),
    localization: localization ?? null,
    metafields: extension.configuration.metafields.length === 0 ? null : extension.configuration.metafields,
    type: extension.configuration.type,

    externalType: extension.externalType,
    uuid: extension.devUUID,

    surface: extension.surface,

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    version: renderer?.version,
    title: extension.configuration.name,
    handle: extension.handle,
    name: extension.configuration.name,
    description: extension.configuration.description,
    apiVersion: extension.configuration.api_version,
    approvalScopes: options.grantedScopes,
    settings: extension.configuration.settings,
  }
  return defaultConfig
}

function getExtensionPoints(extensionPoints: ExtensionInstance['configuration']['extension_points'], url: string) {
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
