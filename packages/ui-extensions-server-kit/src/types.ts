import {FlattenedLocalization, Localization} from './i18n'
import './ExtensionServerClient/types'
import type {Surface} from './ExtensionServerClient/types'

declare global {
  namespace ExtensionServer {
    type ServerEvents =
      | {
          event: 'dispatch'
          data: InboundEvents['dispatch']
        }
      | {
          event: 'connected'
          data: InboundEvents['connected']
        }
      | {
          event: 'update'
          data: InboundEvents['update']
        }

    interface InboundEvents extends DispatchEvents {
      dispatch: {type: keyof DispatchEvents; payload: DispatchEvents[keyof DispatchEvents]}
      connected: {extensions: ExtensionPayload[]; app?: App; store: string}
      update: {extensions?: ExtensionPayload[]; app?: App}
    }

    interface OutboundPersistEvents {
      update: UpdatePersistPayload
    }

    interface DispatchEvents {
      refresh: {uuid: string}[]
      focus: {uuid: string}[]
      unfocus: void
      navigate: {url: string}
    }

    // API responses
    namespace API {
      interface BaseResponse {
        app: App
        root: ResourceURL
        socket: ResourceURL
        devConsole: ResourceURL
        store: string
        version: string
      }

      interface ExtensionsResponse extends BaseResponse {
        extensions: ExtensionPayload[]
      }

      interface ExtensionResponse extends BaseResponse {
        extension: ExtensionPayload
      }
    }

    interface UIExtension extends ExtensionPayload {
      extensionPoints: ExtensionPoint[]
      apiVersion: string
    }
  }
}

// `unknown` stays `unknown`: a mapped type would turn it into `{}`, which rejects full payloads.
export type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>
    }
  : T

type ExtensionPointUpdate = Pick<ExtensionPoint, 'target'> & DeepPartial<ExtensionPoint>

type ExtensionUpdate = Pick<ExtensionPayload, 'uuid'> &
  DeepPartial<Omit<ExtensionPayload, 'extensionPoints'>> & {
    extensionPoints?: string[] | ExtensionPointUpdate[] | null
  }

/**
 * The payload of the `update` event that a client persists to the extension server.
 * The server merges it into its own payload, so a client sends only the fields that change.
 * It finds what to change by the extension's `uuid`, the extension point's `target` and the app's `apiKey`.
 * It ignores the whole message when one of them is missing, or when the `apiKey` is not its app's.
 */
export interface UpdatePersistPayload {
  extensions?: ExtensionUpdate[]
  app?: Pick<App, 'apiKey'> & DeepPartial<App>
}

interface ResourceURL {
  url: string
}

export interface Asset extends ResourceURL {
  name: string
  lastUpdated: number
}

interface Metafield {
  namespace: string
  key: string
  ownerType?: string
}

export interface ExtensionPointIntercept {
  event: string
  blocking: boolean
  applies_to?: string[]
}

export interface ExtensionPointCapabilities {
  allow_direct_linking?: boolean
  intercepts?: ExtensionPointIntercept[]
}

export interface ExtensionPoint {
  target: string
  surface: Surface
  metafields?: Metafield[]
  resource: ResourceURL
  root: ResourceURL
  localization?: FlattenedLocalization | Localization | null
  name: string
  description?: string
  assets?: Record<string, Asset>
  capabilities?: ExtensionPointCapabilities
}

type ExtensionPoints = string[] | ExtensionPoint[] | null

interface CollectBuyerConsentCapabilities {
  smsMarketing: boolean
  customerPrivacy: boolean
}

interface IframeCapabilities {
  sources: string[]
}

interface Capabilities {
  apiAccess: boolean
  blockProgress: boolean
  networkAccess: boolean
  collectBuyerConsent: CollectBuyerConsentCapabilities
  iframe: IframeCapabilities
}

export interface ExtensionPayload {
  type: string
  externalType: string
  assets: Record<string, Asset>
  development: {
    hidden: boolean
    status: Status
    focused?: boolean
    resource: ResourceURL
    root: ResourceURL
    renderer: {
      name: string
      version: string
    }
    error?: {
      message: string
      file?: string
    }
  }
  uuid: string
  version: string
  surface: Surface
  name: string
  description?: string
  handle: string
  extensionPoints: ExtensionPoints
  capabilities?: Capabilities
  supportedFeatures: ExtensionSupportedFeatures
  authenticatedRedirectStartUrl?: string
  authenticatedRedirectRedirectUrls?: string[]
  localization?: FlattenedLocalization | Localization | null
  metafields?: Metafield[] | null
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

export interface ExtensionSupportedFeatures {
  runsOffline: boolean
}

export enum Status {
  Success = 'success',
  Error = 'error',
  /** The server sends an empty status when it has nothing to build. */
  None = '',
}

export interface App {
  id: string
  apiKey: string
  url: string
  mobileUrl: string
  applicationUrl: string
  handle?: string | null
  title: string
  developerName?: string
  icon: {
    transformedSrc: string
  }
  installation?: {
    launchUrl: string
  }
  supportEmail?: string
  supportLocales?: string[]
  allowedDomains?: string[]
  assets?: {
    [key: string]: {
      url: string
      lastUpdated: number
    }
  }
}
