import {UIExtensionPayload, ExtensionsEndpointPayload, DevNewExtensionPointSchema} from './models.js'
import {ExtensionDevOptions} from '../../extension.js'
import {AssetResolver, getUIExtensionPayload, isNewExtensionPointsSchema} from '../payload.js'
import {buildAppURLForMobile, buildAppURLForWeb} from '../../../../utilities/app/app-url.js'
import {ExtensionInstance} from '../../../../models/extensions/extension-instance.js'
import {deepMergeObjects} from '@shopify/cli-kit/common/object'
import {outputDebug, outputContent} from '@shopify/cli-kit/node/output'
import {EventEmitter} from 'events'

export interface ExtensionsPayloadStoreOptions extends ExtensionDevOptions {
  websocketURL: string
}

export enum ExtensionsPayloadStoreEvent {
  Update = 'PayloadUpdatedEvent:UPDATE',
}

export async function getExtensionsPayloadStoreRawPayload(
  options: Omit<ExtensionsPayloadStoreOptions, 'appWatcher'>,
  bundlePath: string,
  resolvers?: Map<string, AssetResolver>,
): Promise<ExtensionsEndpointPayload> {
  const payload: ExtensionsEndpointPayload = {
    app: {
      title: options.appName,
      apiKey: options.apiKey,
      url: buildAppURLForWeb(options.storeFqdn, options.apiKey),
      mobileUrl: buildAppURLForMobile(options.storeFqdn, options.apiKey),
    },
    appId: options.id,
    version: options.manifestVersion,
    root: {
      url: new URL('/extensions', options.url).toString(),
    },
    socket: {
      url: options.websocketURL,
    },
    devConsole: {
      url: new URL('/extensions/dev-console', options.url).toString(),
    },
    store: options.storeFqdn,
    extensions: await Promise.all(
      options.extensions
        .filter((ext) => ext.isPreviewable)
        .map((ext) =>
          getUIExtensionPayload(ext, bundlePath, options, resolvers && getOrCreateResolver(resolvers, ext.devUUID)),
        ),
    ),
  }

  return payload
}

function getOrCreateResolver(resolvers: Map<string, AssetResolver>, devUUID: string): AssetResolver {
  let resolver = resolvers.get(devUUID)
  if (!resolver) {
    resolver = new Map()
    resolvers.set(devUUID, resolver)
  }
  return resolver
}

export class ExtensionsPayloadStore extends EventEmitter {
  private readonly options: ExtensionsPayloadStoreOptions
  private rawPayload: ExtensionsEndpointPayload
  // Per-extension URL → output-relative filesystem path map, refreshed by
  // `getUIExtensionPayload` on every build/rebuild. The dev server middleware
  // consults this to serve the right file when asset basenames collide across
  // extension points (`uniqueBasename` → `tools-1.json` etc.).
  private readonly assetResolvers: Map<string, AssetResolver>

  constructor(
    rawPayload: ExtensionsEndpointPayload,
    options: ExtensionsPayloadStoreOptions,
    assetResolvers: Map<string, AssetResolver> = new Map(),
  ) {
    super()
    this.rawPayload = rawPayload
    this.options = options
    this.assetResolvers = assetResolvers
  }

  getAssetResolver(devUUID: string): AssetResolver | undefined {
    return this.assetResolvers.get(devUUID)
  }

  getConnectedPayload() {
    const rawPayload = this.getRawPayload()
    return {
      app: rawPayload.app,
      appId: rawPayload.appId,
      store: rawPayload.store,
      extensions: rawPayload.extensions,
    }
  }

  getRawPayloadFilteredByExtensionIds(extensionIds: string[]) {
    return {
      ...this.rawPayload,
      extensions: this.rawPayload.extensions.filter((extension) => extensionIds.includes(extension.uuid)),
    }
  }

  getRawPayload() {
    return this.rawPayload
  }

  updateApp(app: Partial<ExtensionsEndpointPayload> & {[key: string]: unknown}) {
    this.rawPayload = deepMergeObjects(this.rawPayload, {
      app,
    })
    this.emitUpdate([])
  }

  updateExtensions(extensions: UIExtensionPayload[]) {
    const updatedExtensionsPayload = this.rawPayload.extensions.map((rawPayloadExtension) => {
      const foundExtension = extensions.find((ext) => ext.uuid === rawPayloadExtension.uuid)

      if (foundExtension) {
        // We can't do a simple union or replacement when it comes to extension points array
        // We need special logic to merge extension points only when the target matches
        if (
          isNewExtensionPointsSchema(foundExtension.extensionPoints) &&
          isNewExtensionPointsSchema(rawPayloadExtension.extensionPoints)
        ) {
          const foundExtensionPointsPayloadMap = foundExtension.extensionPoints.reduce<{
            [key: string]: DevNewExtensionPointSchema
          }>((acc, ex) => {
            return {...acc, [ex.target]: ex}
          }, {})

          rawPayloadExtension.extensionPoints = deepMergeObjects(
            rawPayloadExtension.extensionPoints,
            foundExtension.extensionPoints,
            (destinationArray) => {
              return (destinationArray as DevNewExtensionPointSchema[]).map((extensionPoint) => {
                const extensionPointPayload = foundExtensionPointsPayloadMap[extensionPoint.target]
                if (extensionPointPayload) {
                  return deepMergeObjects(extensionPoint, extensionPointPayload, (_dest, source) => source)
                }
                return extensionPoint
              })
            },
          )

          const {extensionPoints, ...rest} = foundExtension
          return deepMergeObjects(rawPayloadExtension, rest)
        }

        return deepMergeObjects(rawPayloadExtension, foundExtension)
      }

      return rawPayloadExtension
    })

    this.rawPayload = {
      ...this.rawPayload,
      extensions: updatedExtensionsPayload,
    }

    this.emitUpdate(extensions.map((extension) => extension.uuid))
  }

  async updateExtension(
    extension: ExtensionInstance,
    options: Omit<ExtensionsPayloadStoreOptions, 'appWatcher'>,
    bundlePath: string,
    development?: Partial<UIExtensionPayload['development']>,
  ) {
    const payloadExtensions = this.rawPayload.extensions
    const index = payloadExtensions.findIndex((extensionPayload) => extensionPayload.uuid === extension.devUUID)

    if (index === -1) {
      outputDebug(
        outputContent`Could not updateExtension() for extension with uuid: ${extension.devUUID}`,
        options.stderr,
      )
      return
    }

    payloadExtensions[index] = await getUIExtensionPayload(
      extension,
      bundlePath,
      {
        ...this.options,
        currentDevelopmentPayload: development ?? {status: payloadExtensions[index]?.development.status},
        currentLocalizationPayload: payloadExtensions[index]?.localization,
      },
      getOrCreateResolver(this.assetResolvers, extension.devUUID),
    )

    this.rawPayload.extensions = payloadExtensions

    this.emitUpdate([extension.devUUID])
  }

  deleteExtension(extension: ExtensionInstance) {
    const index = this.rawPayload.extensions.findIndex((ext) => ext.uuid === extension.devUUID)
    if (index !== -1) {
      this.rawPayload.extensions.splice(index, 1)
      this.assetResolvers.delete(extension.devUUID)
      this.emitUpdate([extension.devUUID])
    }
  }

  async addExtension(extension: ExtensionInstance, bundlePath: string) {
    this.rawPayload.extensions.push(
      await getUIExtensionPayload(
        extension,
        bundlePath,
        this.options,
        getOrCreateResolver(this.assetResolvers, extension.devUUID),
      ),
    )
    this.emitUpdate([extension.devUUID])
  }

  private emitUpdate(extensionIds: string[]) {
    this.emit(ExtensionsPayloadStoreEvent.Update, extensionIds)
  }
}
