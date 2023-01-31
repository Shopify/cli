import {Localization} from '../localization.js'
import type {NewExtensionPointSchemaType, ApiVersionSchemaType} from '../../../../models/extensions/schemas.js'

export interface ExtensionsPayloadInterface {
  app: {
    apiKey: string
    url: string
    mobileUrl: string
    title: string
  }
  appId?: string
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

export interface DevNewExtensionPointSchema extends NewExtensionPointSchemaType {
  root: {
    url: string
  }
  resource: {
    url: string
  }
}

export interface UIExtensionPayload {
  assets: {
    main: {
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
  extensionPoints: string[] | null | DevNewExtensionPointSchema[]
  localization: Localization | null
  categories: string[] | null
  authenticatedRedirectStartUrl?: string
  authenticatedRedirectRedirectUrls?: string[]
  metafields?: {namespace: string; key: string}[] | null
  type: string
  externalType: string
  apiVersion?: ApiVersionSchemaType
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
