import {
  ExtensionsPayloadStore,
  ExtensionsPayloadStoreOptions,
  getExtensionsPayloadStoreRawPayload,
  ExtensionsPayloadStoreEvent,
} from './store.js'
import {UIExtensionPayload, ExtensionsEndpointPayload} from './models.js'
import * as payload from '../payload.js'
import {ExtensionInstance} from '../../../../models/extensions/extension-instance.js'
import {ExtensionEvent} from '../../app-events/app-event-watcher.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'

function createAdminExtension(config: {static_root?: string; allowed_domains?: string[]} = {}) {
  return {
    type: 'admin',
    isPreviewable: false,
    configuration: {admin: config},
    specification: {},
  } as unknown as ExtensionInstance
}

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
      extensions: [
        {specification: {}, isPreviewable: true},
        {specification: {}, isPreviewable: true},
        {specification: {}, isPreviewable: true},
      ],
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

  test('includes allowed_domains and assets when admin extension is present', async () => {
    // Given
    vi.spyOn(payload, 'getUIExtensionPayload').mockResolvedValue({mock: 'ext'} as unknown as UIExtensionPayload)
    const adminExt = createAdminExtension({static_root: 'public', allowed_domains: ['https://cdn.example.com']})
    const previewableExt = {specification: {}, isPreviewable: true} as unknown as ExtensionInstance

    const options = {
      apiKey: 'api-key',
      appName: 'my-app',
      url: 'https://tunnel.example.com',
      websocketURL: 'wss://tunnel.example.com',
      extensions: [previewableExt, adminExt],
      storeFqdn: 'store.myshopify.com',
      manifestVersion: '3',
    } as unknown as ExtensionsPayloadStoreOptions

    // When
    const rawPayload = await getExtensionsPayloadStoreRawPayload(options, 'bundle-path')

    // Then
    expect(rawPayload.app.allowedDomains).toStrictEqual(['https://cdn.example.com'])
    expect(rawPayload.app.assets).toStrictEqual({
      staticRoot: {
        url: 'https://tunnel.example.com/extensions/assets/staticRoot/',
        lastUpdated: expect.any(Number),
      },
    })
    // Admin extension should not appear in the UI extensions payload
    expect(rawPayload.extensions).toHaveLength(1)
  })

  test('does not include assets or allowed_domains when no admin extension exists', async () => {
    // Given
    vi.spyOn(payload, 'getUIExtensionPayload').mockResolvedValue({mock: 'ext'} as unknown as UIExtensionPayload)

    const options = {
      apiKey: 'api-key',
      appName: 'my-app',
      url: 'https://tunnel.example.com',
      websocketURL: 'wss://tunnel.example.com',
      extensions: [{specification: {}, isPreviewable: true}],
      storeFqdn: 'store.myshopify.com',
      manifestVersion: '3',
    } as unknown as ExtensionsPayloadStoreOptions

    // When
    const rawPayload = await getExtensionsPayloadStoreRawPayload(options, 'bundle-path')

    // Then
    expect(rawPayload.app.allowedDomains).toBeUndefined()
    expect(rawPayload.app.assets).toBeUndefined()
  })

  test('includes allowed_domains but not assets when admin has no static_root', async () => {
    // Given
    vi.spyOn(payload, 'getUIExtensionPayload').mockResolvedValue({mock: 'ext'} as unknown as UIExtensionPayload)
    const adminExt = createAdminExtension({allowed_domains: ['https://cdn.example.com']})

    const options = {
      apiKey: 'api-key',
      appName: 'my-app',
      url: 'https://tunnel.example.com',
      websocketURL: 'wss://tunnel.example.com',
      extensions: [adminExt],
      storeFqdn: 'store.myshopify.com',
      manifestVersion: '3',
    } as unknown as ExtensionsPayloadStoreOptions

    // When
    const rawPayload = await getExtensionsPayloadStoreRawPayload(options, 'bundle-path')

    // Then
    expect(rawPayload.app.allowedDomains).toStrictEqual(['https://cdn.example.com'])
    expect(rawPayload.app.assets).toBeUndefined()
  })

  test('defaults allowed_domains to empty array when admin has no allowed_domains configured', async () => {
    // Given
    vi.spyOn(payload, 'getUIExtensionPayload').mockResolvedValue({mock: 'ext'} as unknown as UIExtensionPayload)
    const adminExt = createAdminExtension({})

    const options = {
      apiKey: 'api-key',
      appName: 'my-app',
      url: 'https://tunnel.example.com',
      websocketURL: 'wss://tunnel.example.com',
      extensions: [adminExt],
      storeFqdn: 'store.myshopify.com',
      manifestVersion: '3',
    } as unknown as ExtensionsPayloadStoreOptions

    // When
    const rawPayload = await getExtensionsPayloadStoreRawPayload(options, 'bundle-path')

    // Then
    expect(rawPayload.app.allowedDomains).toStrictEqual([])
  })
})

describe('ExtensionsPayloadStore()', () => {
  const mockOptions = {extensions: []} as unknown as ExtensionsPayloadStoreOptions

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

    test('replaces arrays in extension points instead of merging them', () => {
      // Given — initial payload has intents with resolved schema (Asset objects)
      const payload = {
        extensions: [
          {
            uuid: '123',
            extensionPoints: [
              {
                target: 'admin.app.intent.link',
                resource: {url: ''},
                intents: [
                  {
                    type: 'application/email',
                    action: 'edit',
                    schema: {name: 'schema', url: '/old-url', lastUpdated: 1},
                  },
                ],
              },
            ],
          },
        ],
      } as unknown as ExtensionsEndpointPayload

      const extensionsPayloadStore = new ExtensionsPayloadStore(payload, mockOptions)

      // When — update with new intents (simulating a rebuild)
      extensionsPayloadStore.updateExtensions([
        {
          uuid: '123',
          extensionPoints: [
            {
              target: 'admin.app.intent.link',
              resource: {url: ''},
              intents: [
                {type: 'application/email', action: 'edit', schema: {name: 'schema', url: '/new-url', lastUpdated: 2}},
              ],
            },
          ],
        },
      ] as unknown as UIExtensionPayload[])

      // Then — intents should be replaced, not accumulated
      const extensionPoints = extensionsPayloadStore.getRawPayload().extensions[0]?.extensionPoints as any[]
      expect(extensionPoints[0].intents).toHaveLength(1)
      expect(extensionPoints[0].intents[0].schema.url).toBe('/new-url')
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
      expect(payload.getUIExtensionPayload).toHaveBeenCalledWith(
        updatedExtension,
        'mock-bundle-path',
        {
          ...mockOptions,
          currentDevelopmentPayload: {hidden: true},
        },
        expect.any(Map),
      )
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
      expect(payload.getUIExtensionPayload).toHaveBeenCalledWith(
        updatedExtension,
        'mock-bundle-path',
        {
          ...mockOptions,
          currentDevelopmentPayload: {
            status: 'success',
          },
        },
        expect.any(Map),
      )
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
      expect(payload.getUIExtensionPayload).toHaveBeenCalledWith(
        updatedExtension,
        'mock-bundle-path',
        {
          ...mockOptions,
          currentDevelopmentPayload: {
            status: 'success',
          },
          currentLocalizationPayload: {
            defaultLocale: 'en',
            lastUpdated: 100,
            translations: {en: {welcome: 'Welcome!'}},
          },
        },
        expect.any(Map),
      )
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

  describe('deleteExtension()', () => {
    test('removes the asset resolver entry for the deleted extension', () => {
      // Given
      const mockPayload = {extensions: [{uuid: '123'}, {uuid: '456'}]} as unknown as ExtensionsEndpointPayload
      const assetResolvers = new Map<string, payload.AssetResolver>([
        ['123', new Map([['CUSTOM_TARGET/tools', 'tools.json']])],
        ['456', new Map([['CUSTOM_TARGET/tools', 'other.json']])],
      ])
      const store = new ExtensionsPayloadStore(mockPayload, mockOptions, assetResolvers)

      // When
      store.deleteExtension({devUUID: '123'} as unknown as ExtensionInstance)

      // Then
      expect(store.getAssetResolver('123')).toBeUndefined()
      expect(store.getAssetResolver('456')).toBeDefined()
    })
  })

  describe('getAppAssets()', () => {
    test('returns asset directories when admin extension has static_root', () => {
      const adminExt = createAdminExtension({static_root: 'public'})
      const options = {extensions: [adminExt], appDirectory: '/app'} as unknown as ExtensionsPayloadStoreOptions
      const store = new ExtensionsPayloadStore({extensions: []} as unknown as ExtensionsEndpointPayload, options)

      expect(store.getAppAssets()).toStrictEqual({staticRoot: '/app/public'})
    })

    test('returns undefined when no admin extension exists', () => {
      const store = new ExtensionsPayloadStore({extensions: []} as unknown as ExtensionsEndpointPayload, mockOptions)

      expect(store.getAppAssets()).toBeUndefined()
    })

    test('returns undefined when admin extension has no static_root', () => {
      const adminExt = createAdminExtension({allowed_domains: ['https://example.com']})
      const options = {extensions: [adminExt], appDirectory: '/app'} as unknown as ExtensionsPayloadStoreOptions
      const store = new ExtensionsPayloadStore({extensions: []} as unknown as ExtensionsEndpointPayload, options)

      expect(store.getAppAssets()).toBeUndefined()
    })
  })

  describe('updateAdminConfigFromExtensionEvents()', () => {
    test('updates allowed_domains and bumps asset timestamps on admin change', () => {
      // Given
      const adminExt = createAdminExtension({allowed_domains: ['https://new.example.com'], static_root: 'public'})
      const options = {extensions: [adminExt], appDirectory: '/app'} as unknown as ExtensionsPayloadStoreOptions
      const initialPayload = {
        app: {
          allowed_domains: ['https://old.example.com'],
          assets: {staticRoot: {url: 'https://tunnel/extensions/assets/staticRoot/', lastUpdated: 1000}},
        },
        extensions: [],
      } as unknown as ExtensionsEndpointPayload

      const store = new ExtensionsPayloadStore(initialPayload, options)
      const onUpdateSpy = vi.fn()
      store.on(ExtensionsPayloadStoreEvent.Update, onUpdateSpy)

      // When
      store.updateAdminConfigFromExtensionEvents([{extension: adminExt} as unknown as ExtensionEvent])

      // Then
      const result = store.getRawPayload()
      expect(result.app.allowedDomains).toStrictEqual(['https://new.example.com'])
      expect(result.app.assets!.staticRoot!.lastUpdated).toBeGreaterThan(1000)
      expect(onUpdateSpy).toHaveBeenCalledWith([])
    })

    test('clears allowed_domains when admin config removes them', () => {
      // Given
      const adminExt = createAdminExtension({static_root: 'public'})
      const options = {extensions: [adminExt], appDirectory: '/app'} as unknown as ExtensionsPayloadStoreOptions
      const initialPayload = {
        app: {allowedDomains: ['https://old.example.com'], assets: {}},
        extensions: [],
      } as unknown as ExtensionsEndpointPayload

      const store = new ExtensionsPayloadStore(initialPayload, options)

      // When
      store.updateAdminConfigFromExtensionEvents([{extension: adminExt} as unknown as ExtensionEvent])

      // Then
      expect(store.getRawPayload().app.allowedDomains).toStrictEqual([])
    })

    test('does nothing when no admin extension event is present', () => {
      // Given
      const store = new ExtensionsPayloadStore(
        {app: {allowedDomains: ['https://example.com']}, extensions: []} as unknown as ExtensionsEndpointPayload,
        mockOptions,
      )
      const onUpdateSpy = vi.fn()
      store.on(ExtensionsPayloadStoreEvent.Update, onUpdateSpy)

      const nonAdminEvent = {
        extension: {type: 'ui_extension'},
      } as unknown as ExtensionEvent

      // When
      store.updateAdminConfigFromExtensionEvents([nonAdminEvent])

      // Then
      expect(store.getRawPayload().app.allowedDomains).toStrictEqual(['https://example.com'])
      expect(onUpdateSpy).not.toHaveBeenCalled()
    })
  })
})
