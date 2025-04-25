import {getLocalization} from './localization.js'
import {Asset, DevNewExtensionPointSchema, UIExtensionPayload} from './payload/models.js'
import {getExtensionPointTargetSurface} from './utilities.js'
import {ExtensionsPayloadStoreOptions} from './payload/store.js'
import {getUIExtensionResourceURL} from '../../../utilities/extensions/configuration.js'
import {getUIExtensionRendererVersion} from '../../../models/app/app.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {BuildManifest} from '../../../models/extensions/specifications/ui_extension.js'
import {fileLastUpdatedTimestamp} from '@shopify/cli-kit/node/fs'
import {useConcurrentOutputContext} from '@shopify/cli-kit/node/ui/components'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'

export type GetUIExtensionPayloadOptions = Omit<ExtensionsPayloadStoreOptions, 'appWatcher'> & {
  currentDevelopmentPayload?: Partial<UIExtensionPayload['development']>
  currentLocalizationPayload?: UIExtensionPayload['localization']
}

export async function getUIExtensionPayload(
  extension: ExtensionInstance,
  bundlePath: string,
  options: GetUIExtensionPayloadOptions,
): Promise<UIExtensionPayload> {
  return useConcurrentOutputContext({outputPrefix: extension.outputPrefix}, async () => {
    const extensionOutputPath = extension.getOutputPathForDirectory(bundlePath)
    const url = `${options.url}/extensions/${extension.devUUID}`
    const {localization, status: localizationStatus} = await getLocalization(extension, options)
    const renderer = await getUIExtensionRendererVersion(extension)
    const extensionPoints = await getExtensionPoints(extension, url)

    let metafields: {namespace: string; key: string}[] | null = null
    if (
      'metafields' in extension.configuration &&
      Array.isArray(extension.configuration.metafields) &&
      extension.configuration.metafields.length > 0
    ) {
      metafields = extension.configuration.metafields
    }

    const defaultConfig = {
      assets: {
        main: {
          name: 'main',
          url: `${url}/assets/${extension.outputFileName}`,
          lastUpdated: (await fileLastUpdatedTimestamp(extensionOutputPath)) ?? 0,
        },
      },
      capabilities: {
        blockProgress: extension.configuration.capabilities?.block_progress ?? false,
        networkAccess: extension.configuration.capabilities?.network_access ?? false,
        apiAccess: extension.configuration.capabilities?.api_access ?? false,
        collectBuyerConsent: {
          smsMarketing: extension.configuration.capabilities?.collect_buyer_consent?.sms_marketing ?? false,
          customerPrivacy: extension.configuration.capabilities?.collect_buyer_consent?.customer_privacy ?? false,
        },
        iframe: {
          sources: extension.configuration.capabilities?.iframe?.sources ?? [],
        },
      },
      development: {
        ...options.currentDevelopmentPayload,
        resource: getUIExtensionResourceURL(extension.type, options),
        root: {
          url,
        },
        hidden: options.currentDevelopmentPayload?.hidden ?? false,
        localizationStatus,
        status: options.currentDevelopmentPayload?.status ?? 'success',
        ...(options.currentDevelopmentPayload ?? {status: 'success'}),
      },
      extensionPoints,
      localization: localization ?? null,
      metafields,
      type: extension.type,

      externalType: extension.externalType,
      uuid: extension.devUUID,

      surface: extension.surface,

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      version: renderer?.version,
      title: extension.name,
      handle: extension.handle,
      name: extension.name,
      description: extension.configuration.description,
      apiVersion: extension.configuration.api_version,
      approvalScopes: options.grantedScopes,
      settings: extension.configuration.settings,
    }
    return defaultConfig
  })
}

async function getExtensionPoints(extension: ExtensionInstance, url: string) {
  let extensionPoints = extension.configuration.extension_points as DevNewExtensionPointSchema[]

  if (extension.type === 'checkout_post_purchase') {
    // Mock target for post-purchase in order to get the right extension point redirect url
    extensionPoints = [{target: 'purchase.post.render'}] as DevNewExtensionPointSchema[]
  }

  if (isNewExtensionPointsSchema(extensionPoints)) {
    return Promise.all(
      extensionPoints.map(async (extensionPoint) => {
        const {target, resource} = extensionPoint

        return {
          ...extensionPoint,
          ...(extensionPoint.build_manifest
            ? {assets: await extractAssetsFromBuildManifest(extensionPoint.build_manifest, url, extension)}
            : {}),
          surface: getExtensionPointTargetSurface(target),
          root: {
            url: `${url}/${target}`,
          },
          resource: resource || {url: ''},
        }
      }),
    )
  }

  return extensionPoints
}

async function extractAssetsFromBuildManifest(buildManifest: BuildManifest, url: string, extension: ExtensionInstance) {
  if (!buildManifest?.assets) return {}
  const assets: {[key: string]: Asset} = {}

  for (const [name, asset] of Object.entries(buildManifest.assets)) {
    assets[name] = {
      name,
      url: `${url}${joinPath('/assets/', asset.filepath)}`,
      // eslint-disable-next-line no-await-in-loop
      lastUpdated: (await fileLastUpdatedTimestamp(joinPath(dirname(extension.outputPath), asset.filepath))) ?? 0,
    }
  }

  return assets
}

export function isNewExtensionPointsSchema(extensionPoints: unknown): extensionPoints is DevNewExtensionPointSchema[] {
  return (
    Array.isArray(extensionPoints) &&
    extensionPoints.every((extensionPoint: unknown) => typeof extensionPoint === 'object')
  )
}
