import {
  ExtensionsPayloadStore,
  ExtensionsPayloadStoreOptions,
  getExtensionsPayloadStoreRawPayload,
  ExtensionsPayloadStoreEvent,
} from './store.js'
import {UIExtensionPayload, ExtensionsEndpointPayload} from './models.js'
import * as payload from '../payload.js'
import {ExtensionInstance} from '../../../../models/extensions/extension-instance.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'

describe('getExtensionsPayloadStoreRawPayload()', () => {
  test('returns the raw payload', async () => {
    // Given
    vi.spyOn(payload, 'getUIExtensionPayload').mockResolvedValue({
      mock: 'extension-payload',
    } as unknown as UIExtensionPayload)

    const options = {
      apiKey: 'mock-api-key',
      appName: 'mock-app-name',
      url: 'https://mock-url.com',
      websocketURL: 'wss://mock-websocket-url.com',
      extensions: [{}, {}, {}],
      storeFqdn: 'mock-store-fqdn.myshopify.com',
      manifestVersion: '3',
    } as unknown as ExtensionsPayloadStoreOptions

    // When
    const rawPayload = await getExtensionsPayloadStoreRawPayload(options, 'mock-bundle-path')

    // Then
    expect(rawPayload).toMatchObject({
      app: {
        title: 'mock-app-name',
        apiKey: 'mock-api-key',
        url: 'https://mock-store-fqdn.myshopify.com/admin/oauth/redirect_from_cli?client_id=mock-api-key',
        mobileUrl:
          'https://mock-store-fqdn.myshopify.com/admin/apps/mock-api-key?shop=mock-store-fqdn.myshopify.com&host=bW9jay1zdG9yZS1mcWRuLm15c2hvcGlmeS5jb20vYWRtaW4vYXBwcy9tb2NrLWFwaS1rZXk',
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
      store: 'mock-store-fqdn.myshopify.com',
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
    test('updates only the extensions existing in the store', () => {
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

    test('deep merge extension points with incoming payload when the target matches', () => {
      // Given
      const payload = {
        extensions: [
          {
            uuid: '123',
            extensionPoints: [
              {target: 'First::Extension::Point', extraProp: '1', resource: {url: ''}},
              {target: 'Second::Extension::Point', extraProp: '2', resource: {url: ''}},
              {target: 'Third::Extension::Point', extraProp: '3', resource: {url: ''}},
            ],
          },
        ],
      } as unknown as ExtensionsEndpointPayload

      const extensionsPayloadStore = new ExtensionsPayloadStore(payload, mockOptions)

      // When
      extensionsPayloadStore.updateExtensions([
        {
          uuid: '123',
          extensionPoints: [
            {target: 'First::Extension::Point', resource: {url: '/first-extension-point-url'}},
            {target: 'Second::Extension::Point', resource: {url: '/second-extension-point-url'}},
          ],
        },
      ] as unknown as UIExtensionPayload[])

      // Then
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      expect(extensionsPayloadStore.getRawPayload().extensions[0]).toMatchObject({
        uuid: '123',
        extensionPoints: [
          {target: 'First::Extension::Point', extraProp: '1', resource: {url: '/first-extension-point-url'}},
          {target: 'Second::Extension::Point', extraProp: '2', resource: {url: '/second-extension-point-url'}},
          {target: 'Third::Extension::Point', extraProp: '3', resource: {url: ''}},
        ],
      })
    })

    test('informs event listeners of updated extensions', () => {
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
      const updatedExtension = {devUUID: '123', updated: 'extension'} as unknown as ExtensionInstance

      // When
      await extensionsPayloadStore.updateExtension(updatedExtension, mockOptions, 'mock-bundle-path', {hidden: true})

      // Then
      expect(payload.getUIExtensionPayload).toHaveBeenCalledWith(updatedExtension, 'mock-bundle-path', {
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
      const updatedExtension = {devUUID: '123', updated: 'extension'} as unknown as ExtensionInstance

      // When
      await extensionsPayloadStore.updateExtension(updatedExtension, mockOptions, 'mock-bundle-path')

      // Then
      expect(payload.getUIExtensionPayload).toHaveBeenCalledWith(updatedExtension, 'mock-bundle-path', {
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
      const updatedExtension = {devUUID: '123', updated: 'extension'} as unknown as ExtensionInstance

      // When
      await extensionsPayloadStore.updateExtension(updatedExtension, mockOptions, 'mock-bundle-path')

      // Then
      expect(payload.getUIExtensionPayload).toHaveBeenCalledWith(updatedExtension, 'mock-bundle-path', {
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
      const updatedExtension = {devUUID: '123', updated: 'extension'} as unknown as ExtensionInstance
      const onUpdateSpy = vi.fn()

      extensionsPayloadStore.on(ExtensionsPayloadStoreEvent.Update, onUpdateSpy)

      // When
      await extensionsPayloadStore.updateExtension(updatedExtension, mockOptions, 'mock-bundle-path')

      // Then
      expect(onUpdateSpy).toHaveBeenCalledWith(['123'])
    })

    test('does not update or inform event listeners if the extension does not exist', async () => {
      // Given
      const mockPayload = {
        extensions: [{uuid: '123'}],
      } as unknown as ExtensionsEndpointPayload

      const extensionsPayloadStore = new ExtensionsPayloadStore(mockPayload, mockOptions)
      const updatedExtension = {devUUID: '789', updated: 'extension'} as unknown as ExtensionInstance
      const onUpdateSpy = vi.fn()
      const initialRawPayload = extensionsPayloadStore.getRawPayload()

      extensionsPayloadStore.on(ExtensionsPayloadStoreEvent.Update, onUpdateSpy)

      // When
      await extensionsPayloadStore.updateExtension(updatedExtension, mockOptions, 'mock-bundle-path')

      // Then
      expect(initialRawPayload).toStrictEqual(extensionsPayloadStore.getRawPayload())
      expect(onUpdateSpy).not.toHaveBeenCalled()
    })
  })
})
