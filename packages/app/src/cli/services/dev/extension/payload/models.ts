import {ExtensionPayload} from '@shopify/ui-extensions-server-kit'

export interface ExtensionsPayloadInterface {
  app: {
    apiKey: string
  }
  store: string
  extensions: ExtensionPayload[]
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
