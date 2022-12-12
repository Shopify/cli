import {
  ExtensionsPayloadStore,
  ExtensionsPayloadStoreOptions,
  getExtensionsPayloadStoreRawPayload,
  ExtensionsPayloadStoreEvent,
} from './store.js'
import {UIExtensionPayload, ExtensionsEndpointPayload} from './models.js'
import * as payload from '../payload.js'
import {UIExtension} from '../../../../models/app/extensions.js'
import {beforeEach, describe, expect, it, test, vi} from 'vitest'

describe('getExtensionsPayloadStoreRawPayload()', () => {
  test('returns the raw payload', async () => {
    // Given
    vi.spyOn(payload, 'getUIExtensionPayload').mockResolvedValue({
      mock: 'extension-payload',
    } as unknown as UIExtensionPayload)

    const options = {
      apiKey: 'mock-api-key',
      url: 'https://mock-url.com',
      websocketURL: 'wss://mock-websocket-url.com',
      extensions: [{}, {}, {}],
      storeFqdn: 'mock-store-fqdn.shopify.com',
    } as unknown as ExtensionsPayloadStoreOptions

    // When
    const rawPayload = await getExtensionsPayloadStoreRawPayload(options)

    // Then
    expect(rawPayload).toMatchObject({
      app: {
        apiKey: 'mock-api-key',
      },
      version: '3',
      root: {
        url: 'https://mock-url.com/extensions',
      },
      socket: {
        url: 'wss://mock-websocket-url.com',
      },
      devConsole: {
        url: 'https://mock-url.com/extensions/dev-console',
      },
      store: 'mock-store-fqdn.shopify.com',
      extensions: [{mock: 'extension-payload'}, {mock: 'extension-payload'}, {mock: 'extension-payload'}],
    })
  })
})

describe('ExtensionsPayloadStore()', () => {
  const mockOptions = {} as unknown as ExtensionsPayloadStoreOptions

  test('getRawPayload() returns the raw payload', async () => {
    // Given
    const extensionsPayloadStore = new ExtensionsPayloadStore(
      {mock: 'payload'} as unknown as ExtensionsEndpointPayload,
      mockOptions,
    )

    // When/Then
    expect(extensionsPayloadStore.getRawPayload()).toMatchObject({
      mock: 'payload',
    })
  })

  test('getConnectedPayload() returns the app, store and extensions', async () => {
    // Given
    const payload = {
      app: {mock: 'app'},
      store: {mock: 'store'},
      extensions: [{mock: 'extensions'}],
    } as unknown as ExtensionsEndpointPayload
    const extensionsPayloadStore = new ExtensionsPayloadStore(payload, mockOptions)

    // When/Then
    expect(extensionsPayloadStore.getConnectedPayload()).toMatchObject({
      app: payload.app,
      store: payload.store,
      extensions: payload.extensions,
    })
  })

  test('getRawPayloadFilteredByExtensionIds() returns the raw payload, filtering extensions by Id', async () => {
    // Given
    const payload = {
      mock: 'payload',
      extensions: [{uuid: '123'}, {uuid: '456'}, {uuid: '789'}, {uuid: '101'}],
    } as unknown as ExtensionsEndpointPayload

    // When
    const extensionsPayloadStore = new ExtensionsPayloadStore(payload, mockOptions)

    // Then
    expect(extensionsPayloadStore.getRawPayloadFilteredByExtensionIds(['123', '789'])).toMatchObject({
      mock: 'payload',
      extensions: [{uuid: '123'}, {uuid: '789'}],
    })
  })

  describe('updateApp()', () => {
    test('merges app data', async () => {
      // Given
      const payload = {
        mock: 'payload',
        app: {mock: 'app'},
        extensions: [{uuid: '123'}, {uuid: '456'}, {uuid: '789'}, {uuid: '101'}],
      } as unknown as ExtensionsEndpointPayload

      const extensionsPayloadStore = new ExtensionsPayloadStore(payload, mockOptions)

      // When
      extensionsPayloadStore.updateApp({foo: 'bar'})

      // Then
      expect(extensionsPayloadStore.getRawPayload()).toStrictEqual({
        mock: 'payload',
        app: {
          mock: 'app',
          foo: 'bar',
        },
        extensions: [{uuid: '123'}, {uuid: '456'}, {uuid: '789'}, {uuid: '101'}],
      })
    })

    test('informs event listeners', async () => {
      // Given
      const payload = {
        extensions: [{uuid: '123'}, {uuid: '456'}, {uuid: '789'}, {uuid: '101'}],
      } as unknown as ExtensionsEndpointPayload

      const extensionsPayloadStore = new ExtensionsPayloadStore(payload, mockOptions)
      const onUpdateSpy = vi.fn()

      extensionsPayloadStore.on(ExtensionsPayloadStoreEvent.Update, onUpdateSpy)

      // When
      extensionsPayloadStore.updateApp({foo: 'bar'})

      // Then
      expect(onUpdateSpy).toHaveBeenCalledWith([])
    })
  })

  describe('updateExtensions() informs event listeners of the updated extensions', () => {
    it('updates only the extensions existing in the store', () => {
      // Given
      const payload = {
        extensions: [{uuid: '123'}],
      } as unknown as ExtensionsEndpointPayload

      const extensionsPayloadStore = new ExtensionsPayloadStore(payload, mockOptions)

      // When
      extensionsPayloadStore.updateExtensions([
        {uuid: '123', test: 'value'},
        {uuid: '789'},
      ] as unknown as UIExtensionPayload[])

      // Then
      expect(extensionsPayloadStore.getRawPayload().extensions.length).toEqual(1)
      expect(extensionsPayloadStore.getRawPayload().extensions[0]?.uuid).toEqual('123')
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      expect(extensionsPayloadStore.getRawPayload().extensions[0]?.test).toEqual('value')
    })

    it('informs event listeners of updated extensions', () => {
      // Given
      const payload = {
        extensions: [{uuid: '123'}, {uuid: '456'}, {uuid: '789'}, {uuid: '101'}],
      } as unknown as ExtensionsEndpointPayload

      const extensionsPayloadStore = new ExtensionsPayloadStore(payload, mockOptions)
      const onUpdateSpy = vi.fn()

      extensionsPayloadStore.on(ExtensionsPayloadStoreEvent.Update, onUpdateSpy)

      // When
      extensionsPayloadStore.updateExtensions([{uuid: '123'}, {uuid: '789'}] as unknown as UIExtensionPayload[])

      // Then
      expect(onUpdateSpy).toHaveBeenCalledWith(['123', '789'])
    })
  })

  describe('updateExtension()', () => {
    beforeEach(() => {
      vi.spyOn(payload, 'getUIExtensionPayload').mockImplementation(async (extension, _options) => {
        return {mock: 'getExtensionsPayloadResponse'} as unknown as UIExtensionPayload
      })
    })

    test('replaces extension data', async () => {
      // Given
      const mockPayload = {
        mock: 'payload',
        extensions: [
          {uuid: '123', foo: 'bar'},
          {uuid: '456', foo: 'bar'},
        ],
      } as unknown as ExtensionsEndpointPayload

      const extensionsPayloadStore = new ExtensionsPayloadStore(mockPayload, mockOptions)
      const updatedExtension = {devUUID: '123', updated: 'extension'} as unknown as UIExtension

      // When
      await extensionsPayloadStore.updateExtension(updatedExtension, mockOptions, {hidden: true})

      // Then
      expect(payload.getUIExtensionPayload).toHaveBeenCalledWith(updatedExtension, {
        ...mockOptions,
        currentDevelopmentPayload: {hidden: true},
      })
      expect(extensionsPayloadStore.getRawPayload()).toStrictEqual({
        mock: 'payload',
        extensions: [{mock: 'getExtensionsPayloadResponse'}, {uuid: '456', foo: 'bar'}],
      })
    })

    test('defaults development.status to the current value', async () => {
      // Given
      const mockPayload = {
        mock: 'payload',
        extensions: [
          {uuid: '123', development: {status: 'success'}},
          {uuid: '456', development: {status: 'error'}},
        ],
      } as unknown as ExtensionsEndpointPayload

      const extensionsPayloadStore = new ExtensionsPayloadStore(mockPayload, mockOptions)
      const updatedExtension = {devUUID: '123', updated: 'extension'} as unknown as UIExtension

      // When
      await extensionsPayloadStore.updateExtension(updatedExtension, mockOptions)

      // Then
      expect(payload.getUIExtensionPayload).toHaveBeenCalledWith(updatedExtension, {
        ...mockOptions,
        currentDevelopmentPayload: {
          status: 'success',
        },
      })
      expect(extensionsPayloadStore.getRawPayload()).toStrictEqual({
        mock: 'payload',
        extensions: [{mock: 'getExtensionsPayloadResponse'}, {uuid: '456', development: {status: 'error'}}],
      })
    })
    test('defaults localization to the current value', async () => {
      // Given
      const mockPayload = {
        mock: 'payload',
        extensions: [
          {
            uuid: '123',
            development: {status: 'success'},
            localization: {defaultLocale: 'en', lastUpdated: 100, translations: {en: {welcome: 'Welcome!'}}},
          },
        ],
      } as unknown as ExtensionsEndpointPayload

      const extensionsPayloadStore = new ExtensionsPayloadStore(mockPayload, mockOptions)
      const updatedExtension = {devUUID: '123', updated: 'extension'} as unknown as UIExtension

      // When
      await extensionsPayloadStore.updateExtension(updatedExtension, mockOptions)

      // Then
      expect(payload.getUIExtensionPayload).toHaveBeenCalledWith(updatedExtension, {
        ...mockOptions,
        currentDevelopmentPayload: {
          status: 'success',
        },
        currentLocalizationPayload: {defaultLocale: 'en', lastUpdated: 100, translations: {en: {welcome: 'Welcome!'}}},
      })
    })

    test('informs event listeners of the updated extension', async () => {
      // Given
      const mockPayload = {
        extensions: [
          {uuid: '123', development: {status: 'success'}},
          {uuid: '456', development: {status: 'success'}},
        ],
      } as unknown as ExtensionsEndpointPayload

      const extensionsPayloadStore = new ExtensionsPayloadStore(mockPayload, mockOptions)
      const updatedExtension = {devUUID: '123', updated: 'extension'} as unknown as UIExtension
      const onUpdateSpy = vi.fn()

      extensionsPayloadStore.on(ExtensionsPayloadStoreEvent.Update, onUpdateSpy)

      // When
      await extensionsPayloadStore.updateExtension(updatedExtension, mockOptions)

      // Then
      expect(onUpdateSpy).toHaveBeenCalledWith(['123'])
    })

    test('Does not update or inform event listeners if the extension does not exist', async () => {
      // Given
      const mockPayload = {
        extensions: [{uuid: '123'}],
      } as unknown as ExtensionsEndpointPayload

      const extensionsPayloadStore = new ExtensionsPayloadStore(mockPayload, mockOptions)
      const updatedExtension = {devUUID: '789', updated: 'extension'} as unknown as UIExtension
      const onUpdateSpy = vi.fn()
      const initialRawPayload = extensionsPayloadStore.getRawPayload()

      extensionsPayloadStore.on(ExtensionsPayloadStoreEvent.Update, onUpdateSpy)

      // When
      await extensionsPayloadStore.updateExtension(updatedExtension, mockOptions)

      // Then
      expect(initialRawPayload).toStrictEqual(extensionsPayloadStore.getRawPayload())
      expect(onUpdateSpy).not.toHaveBeenCalled()
    })
  })
})
