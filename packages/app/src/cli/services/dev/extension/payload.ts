import {getLocalization} from './localization.js'
import {DevNewExtensionPointSchema, UIExtensionPayload} from './payload/models.js'
import {getExtensionPointTargetSurface} from './utilities.js'
import {ExtensionsPayloadStoreOptions} from './payload/store.js'
import {getUIExtensionResourceURL} from '../../../utilities/extensions/configuration.js'
import {getUIExtensionRendererVersion} from '../../../models/app/app.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {NewExtensionPointSchemaType} from '../../../models/extensions/schemas.js'
import {fileExists, fileLastUpdatedTimestamp, readFile} from '@shopify/cli-kit/node/fs'
import {useConcurrentOutputContext} from '@shopify/cli-kit/node/ui/components'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'

export type GetUIExtensionPayloadOptions = Omit<ExtensionsPayloadStoreOptions, 'appWatcher'> & {
  currentDevelopmentPayload?: Partial<UIExtensionPayload['development']>
  currentLocalizationPayload?: UIExtensionPayload['localization']
}

interface AssetMapperContext {
  identifier: string
  extensionPoint: NewExtensionPointSchemaType
  url: string
  extension: ExtensionInstance
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
    const buildDirectory = dirname(extensionOutputPath)
    const extensionPoints = await getExtensionPoints(extension, url, buildDirectory)

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
      supportedFeatures: {
        runsOffline: extension.configuration.supported_features?.runs_offline ?? false,
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

async function getExtensionPoints(extension: ExtensionInstance, url: string, buildDirectory: string) {
  const config = extension.configuration as Record<string, unknown>
  let extensionPoints = (config.extension_points ?? config.targeting) as DevNewExtensionPointSchema[]

  if (extension.type === 'checkout_post_purchase') {
    // Mock target for post-purchase in order to get the right extension point redirect url
    extensionPoints = [{target: 'purchase.post.render'}] as DevNewExtensionPointSchema[]
  }

  if (isNewExtensionPointsSchema(extensionPoints)) {
    const manifest = await readBundleManifest(buildDirectory)

    return Promise.all(
      extensionPoints.map(async (extensionPoint) => {
        const {target, resource} = extensionPoint

        const payload = {
          ...extensionPoint,
          surface: getExtensionPointTargetSurface(target),
          root: {
            url: `${url}/${target}`,
          },
          resource: resource || {url: ''},
        }

        const manifestEntry = manifest?.[target]
        if (!manifestEntry) {
          return payload
        }

        return {
          ...payload,
          ...(await mapManifestAssetsToPayload(
            manifestEntry,
            extensionPoint as unknown as NewExtensionPointSchemaType,
            url,
            extension,
          )),
        }
      }),
    )
  }

  return extensionPoints
}

/**
 * Reads and parses manifest.json from the extension's build output directory.
 * Returns null if the file doesn't exist.
 */
async function readBundleManifest(
  buildDirectory: string,
): Promise<{[target: string]: {[assetName: string]: unknown}} | null> {
  const manifestPath = joinPath(buildDirectory, 'manifest.json')
  if (!(await fileExists(manifestPath))) {
    return null
  }
  const content = await readFile(manifestPath)
  return JSON.parse(content)
}

/**
 * Default asset mapper - reads the source path from the extension point config
 * and adds asset to the assets object
 */
async function defaultAssetMapper({
  identifier,
  extensionPoint,
  url,
  extension,
}: AssetMapperContext): Promise<Partial<DevNewExtensionPointSchema>> {
  const filepath = (extensionPoint as Record<string, unknown>)[identifier]
  if (typeof filepath !== 'string') return {}
  const payload = await getAssetPayload(identifier, filepath, url, extension)
  return {
    assets: {[payload.name]: payload},
  }
}

/**
 * Intents asset mapper - iterates the extension point's intents array
 * and resolves each intent's schema to an asset payload.
 */
async function intentsAssetMapper({
  extensionPoint,
  url,
  extension,
}: AssetMapperContext): Promise<Partial<DevNewExtensionPointSchema>> {
  if (!extensionPoint.intents) return {}

  const intents = await Promise.all(
    extensionPoint.intents.map(async (intent) => ({
      ...intent,
      schema: await getAssetPayload('schema', intent.schema, url, extension),
    })),
  )

  return {intents}
}

type AssetMapper = (context: AssetMapperContext) => Promise<Partial<DevNewExtensionPointSchema>>

/**
 * Asset mappers registry - defines how each asset type should be handled.
 * Assets not in this registry use the defaultAssetMapper.
 */
const ASSET_MAPPERS: {[key: string]: AssetMapper | undefined} = {
  intents: intentsAssetMapper,
}

/**
 * Maps manifest entry to payload format.
 * Uses the manifest entry to know which assets exist for a target,
 * then reads source paths from the extension point config.
 */
async function mapManifestAssetsToPayload(
  manifestEntry: {[assetName: string]: unknown},
  extensionPoint: NewExtensionPointSchemaType,
  url: string,
  extension: ExtensionInstance,
): Promise<Partial<DevNewExtensionPointSchema>> {
  const mappingResults = await Promise.all(
    Object.keys(manifestEntry).map(async (identifier) => {
      const context: AssetMapperContext = {identifier, extensionPoint, url, extension}
      return ASSET_MAPPERS[identifier]?.(context) ?? defaultAssetMapper(context)
    }),
  )

  return mappingResults.reduce<Partial<DevNewExtensionPointSchema>>(
    (acc, result) => ({
      ...acc,
      ...result,
      assets: {...acc.assets, ...result.assets},
    }),
    {},
  )
}

export function isNewExtensionPointsSchema(extensionPoints: unknown): extensionPoints is DevNewExtensionPointSchema[] {
  return (
    Array.isArray(extensionPoints) &&
    extensionPoints.every((extensionPoint: unknown) => typeof extensionPoint === 'object')
  )
}

/**
 * Builds an asset payload entry.
 *
 * `lastUpdated` is read from the source file in the extension directory so that
 * payload updates only fire when the developer actually changes the source — not
 * every time the build copies it fresh into the output directory.
 */
async function getAssetPayload(name: string, filepath: string, url: string, extension: ExtensionInstance) {
  return {
    name,
    url: `${url}${joinPath('/assets/', filepath)}`,
    lastUpdated: (await fileLastUpdatedTimestamp(joinPath(extension.directory, filepath))) ?? 0,
  }
}
