import {UIExtensionPayload, ExtensionsEndpointPayload, DevNewExtensionPointSchema} from './models.js'
import {ExtensionDevOptions} from '../../extension.js'
import {getUIExtensionPayload, isNewExtensionPointsSchema} from '../payload.js'
import {buildAppURLForMobile, buildAppURLForWeb} from '../../../../utilities/app/app-url.js'
import {ExtensionInstance} from '../../../../models/extensions/extension-instance.js'
import {AdminConfigType} from '../../../../models/extensions/specifications/admin.js'
import {ExtensionEvent} from '../../app-events/app-event-watcher.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {deepMergeObjects} from '@shopify/cli-kit/common/object'
import {outputDebug, outputContent} from '@shopify/cli-kit/node/output'
import {EventEmitter} from 'events'

export interface ExtensionsPayloadStoreOptions extends ExtensionDevOptions {
  websocketURL: string
}

interface AdminConfig {
  allowedDomains?: string[]
  staticRoot?: string
}

function getAdminConfig(extensions: ExtensionInstance[]): AdminConfig | undefined {
  const adminExtension = extensions.find((ext) => ext.type === 'admin')
  if (!adminExtension) return undefined
  const admin = (adminExtension.configuration as AdminConfigType).admin
  return {
    allowedDomains: admin?.allowed_domains,
    staticRoot: admin?.static_root,
  }
}

export enum ExtensionsPayloadStoreEvent {
  Update = 'PayloadUpdatedEvent:UPDATE',
}

export async function getExtensionsPayloadStoreRawPayload(
  options: Omit<ExtensionsPayloadStoreOptions, 'appWatcher'>,
  bundlePath: string,
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
        .map((ext) => getUIExtensionPayload(ext, bundlePath, options)),
    ),
  }

  // Admin extension contributes app-level config to the payload
  const adminConfig = getAdminConfig(options.extensions)
  if (adminConfig) {
    payload.app.allowedDomains = adminConfig.allowedDomains
    if (adminConfig.staticRoot) {
      const assetKey = 'staticRoot'
      payload.app.assets = {
        [assetKey]: {
          url: new URL(`/extensions/assets/${assetKey}/`, options.url).toString(),
          lastUpdated: Date.now(),
        },
      }
    }
  }

  return payload
}

export class ExtensionsPayloadStore extends EventEmitter {
  private readonly options: ExtensionsPayloadStoreOptions
  private rawPayload: ExtensionsEndpointPayload
  private appAssetDirectories: Record<string, string> | undefined

  constructor(rawPayload: ExtensionsEndpointPayload, options: ExtensionsPayloadStoreOptions) {
    super()
    this.rawPayload = rawPayload
    this.options = options

    this.refreshAppAssetDirectories()
  }

  getAppAssets(): Record<string, string> | undefined {
    return this.appAssetDirectories
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

    payloadExtensions[index] = await getUIExtensionPayload(extension, bundlePath, {
      ...this.options,
      currentDevelopmentPayload: development ?? {status: payloadExtensions[index]?.development.status},
      currentLocalizationPayload: payloadExtensions[index]?.localization,
    })

    this.rawPayload.extensions = payloadExtensions

    this.emitUpdate([extension.devUUID])
  }

  deleteExtension(extension: ExtensionInstance) {
    const index = this.rawPayload.extensions.findIndex((ext) => ext.uuid === extension.devUUID)
    if (index !== -1) {
      this.rawPayload.extensions.splice(index, 1)
      this.emitUpdate([extension.devUUID])
    }
  }

  async addExtension(extension: ExtensionInstance, bundlePath: string) {
    this.rawPayload.extensions.push(await getUIExtensionPayload(extension, bundlePath, this.options))
    this.emitUpdate([extension.devUUID])
  }

  updateAdminConfigFromExtensionEvents(extensionEvents: ExtensionEvent[]) {
    const adminConfig = getAdminConfig(extensionEvents.map((event) => event.extension))
    if (!adminConfig) return
    this.rawPayload.app.allowedDomains = adminConfig.allowedDomains

    this.refreshAppAssetDirectories()
    if (this.rawPayload.app.assets) {
      for (const key of Object.keys(this.rawPayload.app.assets)) {
        this.rawPayload.app.assets[key]!.lastUpdated = Date.now()
      }
    }

    this.emitUpdate([])
  }

  private refreshAppAssetDirectories() {
    const adminConfig = getAdminConfig(this.options.extensions)
    this.appAssetDirectories = adminConfig?.staticRoot
      ? {staticRoot: joinPath(this.options.appDirectory, adminConfig.staticRoot)}
      : undefined
  }

  private emitUpdate(extensionIds: string[]) {
    this.emit(ExtensionsPayloadStoreEvent.Update, extensionIds)
  }
}
