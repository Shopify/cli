import {ExtensionTypes, ExternalExtensionTypes} from '../../../../constants.js'
import {Localization} from '../localization.js'

export interface ExtensionsPayloadInterface {
  app: {
    apiKey: string
  }
  store: string
  extensions: UIExtensionPayload[]
}

export interface ExtensionsEndpointPayload extends ExtensionsPayloadInterface {
  version: string
  root: {
    url: string
  }
  devConsole: {
    url: string
  }
  socket: {
    url: string
  }
}

export interface UIExtensionPayload {
  assets: {
    main: {
      name: 'main'
      url: string
      lastUpdated: number
    }
  }
  capabilities?: Capabilities
  development: {
    resource: {
      url?: string
    }
    root: {
      url: string
    }
    hidden: boolean
    status: ExtensionAssetBuildStatus
    localizationStatus: ExtensionAssetBuildStatus
  }
  extensionPoints: string[] | null | {metafields?: {namespace: string; key: string}[]; target: string; module: string}[]
  localization: Localization | null
  categories: string[] | null
  metafields?: {namespace: string; key: string}[] | null
  type: ExtensionTypes
  externalType: ExternalExtensionTypes
  uuid: string
  version?: string
  surface: string
  title: string
  approvalScopes: string[]
}

export type ExtensionAssetBuildStatus = 'success' | 'error' | ''

export interface Capabilities {
  [key: string]: boolean | undefined
}
