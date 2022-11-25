/* eslint-disable @shopify/strict-component-boundaries */
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
  }
}

export type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>
}

export interface ResourceURL {
  name: string
  url: string
  lastUpdated: number
}

export interface ExtensionPayload {
  type: string
  externalType: string
  assets: {[name: string]: ResourceURL}
  development: {
    hidden: boolean
    status: Status
    focused?: boolean
    resource: {
      url: string
    }
    root: {
      url: string
    }
    renderer: {
      name: string
      version: string
    }
  }
  uuid: string
  version: string
  surface: Surface
  title: string
  extensionPoints?: string[] | {target: string; module: string; main: {url: string}}
  categories?: string[]
  localization?: {
    defaultLocale: string
    lastUpdated: number
    translations: {[locale: string]: ExtensionTranslationMap}
  }
}

export enum Status {
  Error = 'error',
  Success = 'success',
}

export interface App {
  id: string
  apiKey: string
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

interface ExtensionTranslationMap {
  [key: string]: string
}
