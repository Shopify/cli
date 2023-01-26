import {UIExtensionPayload, ExtensionsEndpointPayload, DevNewExtensionPointSchema} from './models.js'
import {ExtensionDevOptions} from '../../extension.js'
import {getUIExtensionPayload, isNewExtensionPointsSchema} from '../payload.js'
import {UIExtension} from '../../../../models/app/extensions.js'
import {buildAppURLForMobile, buildAppURLForWeb} from '../../../../utilities/app/app-url.js'
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
  options: ExtensionsPayloadStoreOptions,
): Promise<ExtensionsEndpointPayload> {
  return {
    app: {
      title: options.app.name,
      apiKey: options.apiKey,
      url: buildAppURLForWeb(options.storeFqdn, options.url),
      mobileUrl: buildAppURLForMobile(options.storeFqdn, options.apiKey),
    },
    appId: options.id,
    version: '3',
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
    extensions: await Promise.all(options.extensions.map((extension) => getUIExtensionPayload(extension, options))),
  }
}

export class ExtensionsPayloadStore extends EventEmitter {
  private options: ExtensionsPayloadStoreOptions
  private rawPayload: ExtensionsEndpointPayload

  constructor(rawPayload: ExtensionsEndpointPayload, options: ExtensionsPayloadStoreOptions) {
    super()
    this.rawPayload = rawPayload
    this.options = options
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
          const foundExtensionPointsPayloadMap = foundExtension.extensionPoints.reduce((acc, ex) => {
            return {...acc, [ex.target]: ex}
          }, {} as {[key: string]: DevNewExtensionPointSchema})

          rawPayloadExtension.extensionPoints = deepMergeObjects(
            rawPayloadExtension.extensionPoints,
            foundExtension.extensionPoints,
            (destinationArray) => {
              return (destinationArray as DevNewExtensionPointSchema[]).map((extensionPoint) => {
                const extensionPointPayload = foundExtensionPointsPayloadMap[extensionPoint.target]
                if (extensionPointPayload) {
                  return deepMergeObjects(extensionPoint, extensionPointPayload)
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
    extension: UIExtension,
    options: ExtensionDevOptions,
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

    payloadExtensions[index] = await getUIExtensionPayload(extension, {
      ...this.options,
      currentDevelopmentPayload: development || {status: payloadExtensions[index]?.development.status},
      currentLocalizationPayload: payloadExtensions[index]?.localization,
    })

    this.rawPayload.extensions = payloadExtensions

    this.emitUpdate([extension.devUUID])
  }

  private emitUpdate(extensionIds: string[]) {
    this.emit(ExtensionsPayloadStoreEvent.Update, extensionIds)
  }
}
