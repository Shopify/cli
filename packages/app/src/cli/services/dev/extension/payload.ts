import {getLocalization} from './localization.js'
import {DevNewExtensionPointSchema, UIExtensionPayload} from './payload/models.js'
import {getExtensionPointTargetSurface} from './utilities.js'
import {ExtensionsPayloadStoreOptions} from './payload/store.js'
import {getUIExtensionResourceURL} from '../../../utilities/extensions/configuration.js'
import {getUIExtensionRendererVersion} from '../../../models/app/app.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {fileLastUpdatedTimestamp, readFile} from '@shopify/cli-kit/node/fs'
import {useConcurrentOutputContext} from '@shopify/cli-kit/node/ui/components'
import {dirname, extname, joinPath} from '@shopify/cli-kit/node/path'

export type GetUIExtensionPayloadOptions = Omit<ExtensionsPayloadStoreOptions, 'appWatcher'> & {
  currentDevelopmentPayload?: Partial<UIExtensionPayload['development']>
  currentLocalizationPayload?: UIExtensionPayload['localization']
}

/**
 * Per-extension map from an asset's URL subpath (relative to
 * `/extensions/<devUUID>/assets/`) to its output-relative filesystem path
 * inside the extension's bundle directory.
 *
 * Populated during payload generation as URLs are emitted; consumed by the
 * dev-server middleware to serve the right file when two extension points
 * reference assets that share a basename (e.g. `../tools.json` and
 * `./tools.json` both collapsed to `tools` by `uniqueBasename`).
 */
export type AssetResolver = Map<string, string>

/**
 * Fields that stay constant across every asset mapping within one extension-point
 * pass. Built once in `getExtensionPoints` and threaded into each mapper; the
 * per-call parts (`identifier`, `manifestValue`) are passed as positional args.
 */
interface MappingContext {
  target: string
  extensionPoint: DevNewExtensionPointSchema
  url: string
  extension: ExtensionInstance
  buildDirectory: string
  resolver?: AssetResolver
}

export async function getUIExtensionPayload(
  extension: ExtensionInstance,
  bundlePath: string,
  options: GetUIExtensionPayloadOptions,
  resolver?: AssetResolver,
): Promise<UIExtensionPayload> {
  return useConcurrentOutputContext({outputPrefix: extension.outputPrefix}, async () => {
    // Each payload regeneration is the source of truth for this extension's
    // URL → filesystem mapping. Clear previous entries so stale targets or
    // removed assets don't linger.
    resolver?.clear()
    const extensionOutputPath = extension.getOutputPathForDirectory(bundlePath)
    const url = `${options.url}/extensions/${extension.devUUID}`
    const {localization, status: localizationStatus} = await getLocalization(extension, options)
    const renderer = await getUIExtensionRendererVersion(extension)
    // If the extension has a custom output relative path, use that as the build directory
    // ex. ext/dist/handle.js -> ext/dist
    const buildDirectory = extension.outputRelativePath ? dirname(extensionOutputPath) : extensionOutputPath
    const extensionPoints = await getExtensionPoints(extension, url, buildDirectory, resolver)

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
        main:
          isNewExtensionPointsSchema(extensionPoints) && extensionPoints[0]?.assets?.main
            ? extensionPoints[0].assets.main
            : {
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

async function getExtensionPoints(
  extension: ExtensionInstance,
  url: string,
  buildDirectory: string,
  resolver?: AssetResolver,
) {
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

        const ctx: MappingContext = {target, extensionPoint, url, extension, buildDirectory, resolver}
        const mappedResult = await mapManifestAssetsToPayload(manifestEntry, ctx)
        return {...payload, ...mappedResult}
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
  try {
    const manifestPath = joinPath(buildDirectory, 'manifest.json')
    const content = await readFile(manifestPath)
    return JSON.parse(content)
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid manifest.json in ${buildDirectory}: ${error.message}`)
    }
    return null
  }
}

/**
 * Default asset mapper - emits resolver-keyed URLs (`<target>/<identifier>`)
 * and registers the manifest's output-relative path in the resolver so the dev
 * server serves the right file per extension point. The raw config value is
 * passed as sourcePath so `lastUpdated` reflects source edits.
 * Falls back to build_manifest.assets for compiled assets like main and
 * should_render where the config field name doesn't match the asset identifier.
 */
async function defaultAssetMapper(
  {target, extensionPoint, url, extension, resolver}: MappingContext,
  identifier: string,
  manifestValue: unknown,
): Promise<Partial<DevNewExtensionPointSchema>> {
  const urlSubpath = `${target}/${identifier}`
  // Dynamic key lookup — identifier can be "tools", "instructions", etc.
  const rawFilepath = extensionPoint[identifier as keyof typeof extensionPoint]
  if (typeof rawFilepath === 'string') {
    const filepath = typeof manifestValue === 'string' ? manifestValue : rawFilepath
    const sourcePath = typeof manifestValue === 'string' ? rawFilepath : undefined
    const payload = await getAssetPayload(identifier, urlSubpath, filepath, url, extension, resolver, sourcePath)
    return {assets: {[payload.name]: payload}}
  }

  const buildManifest = extensionPoint.build_manifest
  const asset = buildManifest?.assets?.[identifier as keyof typeof buildManifest.assets]
  if (asset?.filepath) {
    const payload = await getAssetPayload(
      identifier,
      urlSubpath,
      asset.filepath,
      url,
      extension,
      resolver,
      asset.module,
    )
    return {assets: {[payload.name]: payload}}
  }

  return {}
}

/**
 * Static assets mapper - handles directory-valued configs (e.g. `assets = "./assets"`).
 * `include_assets` copies every file into the bundle and the manifest entry is
 * an array of output-relative file paths. Emits one payload entry for the
 * directory (URL prefix with trailing slash), registers a resolver entry per
 * file so the middleware can serve individual fetches, and reports `lastUpdated`
 * as the max mtime across the directory so in-place edits surface.
 */
async function staticAssetsMapper(
  {target, url, buildDirectory, resolver}: MappingContext,
  identifier: string,
  files: string[],
): Promise<Partial<DevNewExtensionPointSchema>> {
  if (files.length === 0) return {}
  const urlSubpath = `${target}/${identifier}`
  for (const file of files) {
    resolver?.set(`${urlSubpath}/${file}`, file)
  }
  const updatedTimestamps = await Promise.all(
    files.map(async (file) => (await fileLastUpdatedTimestamp(joinPath(buildDirectory, file))) ?? 0),
  )
  return {
    assets: {
      [identifier]: {
        name: identifier,
        url: `${url}/assets/${urlSubpath}/`,
        lastUpdated: Math.max(...updatedTimestamps),
      },
    },
  }
}

/**
 * Intents asset mapper - iterates the extension point's intents array and
 * resolves each intent's schema to an asset payload. Each intent's URL is
 * scoped by its index (`<target>/intents/<index>/schema`) so two intents
 * whose schema sources would share a basename still resolve correctly.
 */
async function intentsAssetMapper(
  {target, extensionPoint, url, extension, resolver}: MappingContext,
  manifestIntents: {schema: string}[],
): Promise<Partial<DevNewExtensionPointSchema>> {
  if (!extensionPoint.intents) return {}

  const intents = await Promise.all(
    extensionPoint.intents.map(async (intent, index) => {
      const rawSchema = intent.schema as string
      const manifestSchema = manifestIntents[index]?.schema
      const filepath = typeof manifestSchema === 'string' ? manifestSchema : rawSchema
      const sourcePath = typeof manifestSchema === 'string' ? rawSchema : undefined
      return {
        ...intent,
        schema: await getAssetPayload(
          'schema',
          `${target}/intents/${index}/schema`,
          filepath,
          url,
          extension,
          resolver,
          sourcePath,
        ),
      }
    }),
  )

  return {intents}
}

/**
 * Mapper for compiled built assets (main, should_render).
 * Reads the filepath directly from manifest.json so the bundleFolder prefix is preserved.
 */
async function builtAssetMapper(
  {target, url, extension, resolver}: MappingContext,
  identifier: string,
  manifestValue: string,
): Promise<Partial<DevNewExtensionPointSchema>> {
  const payload = await getAssetPayload(identifier, `${target}/${identifier}`, manifestValue, url, extension, resolver)
  return {assets: {[payload.name]: payload}}
}

/**
 * Maps manifest entry to payload format.
 * Uses the manifest entry to know which assets exist for a target,
 * then reads source paths from the extension point config.
 * Dispatches each identifier to the mapper whose expected `manifestValue` shape
 * matches. Unknown identifiers (or known ones with mismatched shapes) fall
 * through to `defaultAssetMapper`.
 */
async function mapManifestAssetsToPayload(
  manifestEntry: {[assetName: string]: unknown},
  ctx: MappingContext,
): Promise<Partial<DevNewExtensionPointSchema>> {
  const mappingResults = await Promise.all(
    Object.keys(manifestEntry).map(async (identifier) => {
      const value = manifestEntry[identifier]
      if (isIntentsAsset(identifier, value)) return intentsAssetMapper(ctx, value)
      if (isBuiltAsset(identifier, value)) return builtAssetMapper(ctx, identifier, value)
      if (isStaticAsset(identifier, value)) return staticAssetsMapper(ctx, identifier, value)
      return defaultAssetMapper(ctx, identifier, value)
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
 * The emitted URL is opaque — `/assets/<urlSubpath>` — and the actual
 * filesystem path (`filepath`, relative to the extension's output directory) is
 * recorded in `resolver` so the dev-server middleware can serve the right file
 * even when two extension points reference sources whose basenames collide.
 *
 * @param name - The asset key as it appears in the payload (`main`, `tools`,
 *   `schema`, …). Included in the payload for consumers that key by name.
 * @param urlSubpath - Target-scoped URL subpath. Typically `<target>/<name>`;
 *   `intents` map to `<target>/intents/<index>/schema` to disambiguate array
 *   entries.
 * @param filepath - Output-relative path inside the extension's bundle (what
 *   the middleware will ultimately read).
 * @param sourcePath - Optional source file path for the timestamp. When
 *   provided (e.g. for compiled assets or static assets copied from outside
 *   the extension), `lastUpdated` reads the source file's mtime so edits there
 *   reflect in the payload.
 */
async function getAssetPayload(
  name: string,
  urlSubpath: string,
  filepath: string,
  url: string,
  extension: ExtensionInstance,
  resolver?: AssetResolver,
  sourcePath?: string,
) {
  // Preserve the source file's extension in the URL so clients can infer the
  // content type from the URL and the middleware's resolver key matches the
  // emitted URL 1:1.
  const urlSubpathWithExt = `${urlSubpath}${extname(filepath)}`
  resolver?.set(urlSubpathWithExt, filepath)
  return {
    name,
    url: `${url}/assets/${urlSubpathWithExt}`,
    lastUpdated: (await fileLastUpdatedTimestamp(joinPath(extension.directory, sourcePath ?? filepath))) ?? 0,
  }
}

function isIntentsAsset(identifier: string, value: unknown): value is {schema: string}[] {
  return identifier === 'intents' && Array.isArray(value)
}

function isBuiltAsset(identifier: string, value: unknown): value is string {
  return (identifier === 'main' || identifier === 'should_render') && typeof value === 'string'
}

function isStaticAsset(identifier: string, value: unknown): value is string[] {
  return (
    identifier === 'assets' &&
    Array.isArray(value) &&
    value.every((entry): entry is string => typeof entry === 'string')
  )
}
