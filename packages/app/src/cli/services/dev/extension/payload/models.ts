import {Localization} from '../localization.js'
import {BuildManifest} from '../../../../models/extensions/specifications/ui_extension.js'
import type {NewExtensionPointSchemaType, ApiVersionSchemaType} from '../../../../models/extensions/schemas.js'

interface ExtensionsPayloadInterface {
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
export interface Asset {
  name: string
  url: string
  lastUpdated: number
}

export interface DevNewExtensionPointSchema extends NewExtensionPointSchemaType {
  build_manifest: BuildManifest
  assets: {
    [name: string]: Asset
  }
  root: {
    url: string
  }
  resource: {
    url: string
  }
}

export interface UIExtensionPayload {
  assets: {
    main: Asset
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
  authenticatedRedirectStartUrl?: string
  authenticatedRedirectRedirectUrls?: string[]
  metafields?: {namespace: string; key: string}[] | null
  type: string
  externalType: string
  apiVersion?: ApiVersionSchemaType
  uuid: string
  version?: string
  surface: string
  // @deprecated: we should be using handle instead
  title: string
  // unique internal developer facing name for the extension
  handle: string
  // user facing name for the extension
  name: string
  description?: string
  approvalScopes: string[]
  settings?: {
    fields?: {
      type: string
      key?: string
      name?: string
      description?: string
      required?: boolean
      validations?: unknown[]
    }[]
  }
}

export type ExtensionAssetBuildStatus = 'success' | 'error' | ''

interface Capability {
  [key: string]: boolean | undefined
}

interface IframeCapability {
  sources: string[] | undefined
}

interface Capabilities {
  [key: string]: Capability | IframeCapability | boolean | undefined
}
