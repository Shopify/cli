import {Localization} from '../localization.js'
import type {NewExtensionPointSchemaType, ApiVersionSchemaType} from '../../../../models/extensions/schemas.js'
import type {BuildManifest} from '../../../../models/extensions/specifications/ui_extension.js'

interface ExtensionsPayloadInterface {
  app: {
    apiKey: string
    url: string
    mobileUrl: string
    title: string
    allowedDomains?: string[]
    assets?: {
      [key: string]: {
        url: string
        lastUpdated: number
      }
    }
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
interface Asset {
  name: string
  url: string
  lastUpdated: number
}

export interface DevNewExtensionPointSchema extends Omit<NewExtensionPointSchemaType, 'intents' | 'assets'> {
  assets: {
    [name: string]: Asset
  }
  root: {
    url: string
  }
  resource: {
    url: string
  }
  build_manifest?: BuildManifest
  intents?: {
    type: string
    action: string
    name?: string
    description?: string
    schema: string | Asset
  }[]
}

interface SupportedFeatures {
  runsOffline: boolean
}

export interface UIExtensionPayload {
  assets: {
    main: Asset
  }
  supportedFeatures?: SupportedFeatures
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
    error?: {
      message: string
      file?: string
    }
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
