/* eslint-disable @shopify/strict-component-boundaries */
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
      update: {
        extensions?: ({uuid: string} & DeepPartial<ExtensionPayload>)[]
        app?: DeepPartial<App>
      }
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

export type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>
}

export interface ResourceURL {
  url: string
}

export interface Asset extends ResourceURL {
  name: string
  lastUpdated: number
}

export interface Metafield {
  namespace: string
  key: string
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
}

export type ExtensionPoints = string[] | ExtensionPoint[] | null

interface CollectBuyerConsentCapabilities {
  smsMarketing: boolean
  customerPrivacy: boolean
}

interface Capabilities {
  apiAccess: boolean
  blockProgress: boolean
  networkAccess: boolean
  collectBuyerConsent: CollectBuyerConsentCapabilities
}

export interface ExtensionPayload {
  type: string
  externalType: string
  assets: {[name: string]: Asset}
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
  }
  uuid: string
  version: string
  surface: Surface
  name: string
  description?: string
  handle: string
  extensionPoints: ExtensionPoints
  capabilities?: Capabilities
  authenticatedRedirectStartUrl?: string
  authenticatedRedirectRedirectUrls?: string[]
  localization?: FlattenedLocalization | Localization | null
  settings?: {
    fields?: {
      type: string
      key?: string
      name?: string
      description?: string
      required?: boolean
      validations?: any[]
    }[]
  }
}

export enum Status {
  Error = 'error',
  Success = 'success',
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
}
