import {getHotReloadHandler, getInMemoryTemplates, setupInMemoryTemplateWatcher} from './server.js'
import {fakeThemeFileSystem} from '../../theme-fs/theme-fs-mock-factory.js'
import {render} from '../storefront-renderer.js'
import {emptyThemeExtFileSystem} from '../../theme-fs-empty.js'
import {describe, test, expect, vi} from 'vitest'
import {createEvent} from 'h3'
import {Response as NodeResponse} from '@shopify/cli-kit/node/http'
import {IncomingMessage, ServerResponse} from 'node:http'
import {Socket} from 'node:net'
import type {DevServerContext} from '../types.js'
import type {Theme, ThemeFSEventName} from '@shopify/cli-kit/node/themes/types'

vi.mock('../storefront-renderer.js')

describe('hot-reload server', () => {
  const mockTheme: Theme = {
    id: 123,
    name: 'my-theme',
    createdAtRuntime: false,
    processing: false,
    role: 'main',
  }

  test('emits hot-reload events with proper data', async () => {
    const testSectionType = 'my-test'
    const testSectionFileKey = `sections/${testSectionType}.liquid`
    const assetJsonKey = 'templates/asset.json'
    const liquidAssetKey = 'assets/style.css.liquid'
    const assetJsonValue = {
      sections: {first: {type: testSectionType}, second: {type: testSectionType}, third: {type: 'something-else'}},
    }
    const {ctx, addEventListenerSpy, triggerFileEvent, nextTick, hotReloadHandler} = createTestContext({
      files: [
        [assetJsonKey, JSON.stringify(assetJsonValue)],
        [liquidAssetKey, ''],
      ],
    })

    await setupInMemoryTemplateWatcher(ctx)
    const {event: subscribeEvent, data: hotReloadEvents} = createH3Event('/__hot-reload/subscribe')
    const streamPromise = hotReloadHandler(subscribeEvent)
    // Next tick to flush the connection:
    await nextTick()

    // -- Initial state:
    expect(addEventListenerSpy).toHaveBeenCalled()
    expect(addEventListenerSpy).toHaveBeenCalledWith('add', expect.any(Function))
    expect(addEventListenerSpy).toHaveBeenCalledWith('change', expect.any(Function))
    expect(addEventListenerSpy).toHaveBeenCalledWith('unlink', expect.any(Function))
    // Wait for syncing to finish:
    await nextTick()
    expect(getInMemoryTemplates(ctx)).toEqual({})

    // -- Subscribes to HotReload events:
    expect(hotReloadEvents).toHaveLength(1)
    // Opens the SSE with the server PID:
    expect(hotReloadEvents.at(-1)).toMatch(`data: {"type":"open","pid":"${process.pid}"}`)

    // -- Updates section files:
    const {contentSpy: addSectionContentSpy} = await triggerFileEvent('add', testSectionFileKey)
    expect(addSectionContentSpy).toHaveBeenCalled()
    expect(getInMemoryTemplates(ctx)).toEqual({[testSectionFileKey]: expect.any(String)})
    // Finds section names based on the existing JSON file:
    expect(hotReloadEvents.at(-1)).toMatch(
      `data: {"type":"section","key":"${testSectionFileKey}","names":["first","second"]}`,
    )

    // -- Renders the section HTML:
    vi.mocked(render).mockResolvedValue(
      new NodeResponse('<div><link href="https://my-store.myshopify.com/cdn/path/assets/file.css"></link></div>'),
    )
    const renderResult = await hotReloadHandler(
      createH3Event(`/__hot-reload/render?section-id=123__first&section-template-name=${testSectionFileKey}`).event,
    )
    expect(render).toHaveBeenCalledOnce()
    expect(render).toHaveBeenCalledWith(
      ctx.session,
      expect.objectContaining({
        path: '/',
        sectionId: '123__first',
        replaceTemplates: {[testSectionFileKey]: 'default-value'},
      }),
    )
    // Patches the rendering response:
    expect(renderResult).toEqual('<div><link href="/cdn/path/assets/file.css"></link></div>')

    // -- Deletes in-memory section after syncing
    await nextTick()
    expect(getInMemoryTemplates(ctx)).toEqual({})

    // -- Updates the JSON file with all its side effects:
    // Make the third type match the file:
    assetJsonValue.sections.third.type = testSectionType
    const newAssetJsonValue = JSON.stringify(assetJsonValue)
    await triggerFileEvent('change', assetJsonKey, newAssetJsonValue)
    expect(getInMemoryTemplates(ctx)).toEqual({[assetJsonKey]: newAssetJsonValue})
    // Full refresh:
    expect(hotReloadEvents.at(-1)).toMatch(`data: {"type":"full","key":"${assetJsonKey}"}`)

    // -- Renders the section HTML:
    await hotReloadHandler(
      createH3Event(`/__hot-reload/render?section-id=123__third&section-template-name=${testSectionFileKey}`).event,
    )
    // The section has already been removed from memory because it's synced in the cloud.
    // However, the JSON file still needs to be sent to the cloud:
    expect(render).toHaveBeenLastCalledWith(
      ctx.session,
      expect.objectContaining({
        path: '/',
        sectionId: '123__third',
        replaceTemplates: {[assetJsonKey]: newAssetJsonValue},
      }),
    )

    // Deletes in-memory after syncing
    await nextTick()
    expect(getInMemoryTemplates(ctx)).toEqual({})
    // Further updates to sections are affected:
    await triggerFileEvent('change', testSectionFileKey)
    expect(hotReloadEvents.at(-1)).toMatch(
      `data: {"type":"section","key":"${testSectionFileKey}","names":["first","second","third"]}`,
    )
    await nextTick()

    // -- Unlinks the JSON file properly with all its side effects:
    await triggerFileEvent('unlink', assetJsonKey)
    // We don't know if this file is referenced or not in code so it emits a full reload event:
    expect(hotReloadEvents.at(-1)).toMatch(`data: {"type":"full","key":"${assetJsonKey}"}`)
    // Removes the JSON file from memory:
    expect(getInMemoryTemplates(ctx)).toEqual({})
    await nextTick()

    // -- Unlinks CSS Liquid files
    const {syncSpy: unlinkSyncSpy} = await triggerFileEvent('unlink', liquidAssetKey)
    // We wait for syncing to finish on liquid assets before emitting a full reload event:
    await nextTick()
    expect(unlinkSyncSpy).toHaveBeenCalled()
    expect(hotReloadEvents.at(-1)).toMatch(`data: {"type":"css","key":"${liquidAssetKey.replace('.liquid', '')}"}`)
    // Removes the CSS Liquid file from memory:
    expect(getInMemoryTemplates(ctx)).toEqual({})

    // Since the JSON file was removed, the section file is not referenced anymore:
    await triggerFileEvent('change', testSectionFileKey)
    expect(hotReloadEvents.at(-1)).toMatch(`data: {"type":"full","key":"${testSectionFileKey}"}`)
    await nextTick()

    // -- Updates section groups:
    const sectionGroupFileKey = testSectionFileKey.replace('.liquid', '.json')
    const sectionGroupContent = JSON.stringify({
      sections: {first: {type: testSectionType}, second: {type: testSectionType}},
    })
    const {contentSpy: addSectionGroupContentSpy} = await triggerFileEvent(
      'add',
      sectionGroupFileKey,
      sectionGroupContent,
    )
    expect(addSectionGroupContentSpy).toHaveBeenCalled()
    expect(getInMemoryTemplates(ctx)).toEqual({[sectionGroupFileKey]: sectionGroupContent})
    // Finds section names based on the existing JSON file:
    expect(hotReloadEvents.at(-1)).toMatch(
      `data: {"type":"section","key":"${sectionGroupFileKey}","names":["first","second"]}`,
    )

    // -- Updates CSS files:
    const cssFileKey = 'assets/style.css'
    const {syncSpy: cssSyncSpy} = await triggerFileEvent('add', cssFileKey)
    // It does not add assets to the in-memory templates:
    expect(getInMemoryTemplates(ctx)).toEqual({})
    // Emits a CSS HotReload event immediately without waiting for syncing:
    expect(cssSyncSpy).not.toHaveBeenCalled()
    expect(hotReloadEvents.at(-1)).toMatch(`data: {"type":"css","key":"${cssFileKey}"}`)

    // -- Updates CSS Liquid files:
    const cssLiquidFileKey = 'assets/style.css.liquid'
    const {syncSpy: cssLiquidSyncSpy} = await triggerFileEvent('add', cssLiquidFileKey)
    // It does not add assets to the in-memory templates:
    expect(getInMemoryTemplates(ctx)).toEqual({})
    // Emits a CSS HotReload event after syncing:
    expect(cssLiquidSyncSpy).toHaveBeenCalled()
    await nextTick()
    // Removes the `.liquid` extension before sending it to the browser:
    expect(hotReloadEvents.at(-1)).toMatch(`data: {"type":"css","key":"${cssLiquidFileKey.replace('.liquid', '')}"}`)

    // -- Updates other files:
    const jsFileKey = 'assets/something.js'
    const {syncSpy: jsSyncSpy} = await triggerFileEvent('add', jsFileKey)
    expect(jsSyncSpy).not.toHaveBeenCalled()
    expect(hotReloadEvents.at(-1)).toMatch(`data: {"type":"full","key":"${jsFileKey}"}`)

    // -- Filters templates by route:
    const indexJson = 'templates/index.json'
    const searchJson = 'templates/search.json'
    const jsonContent = '{}'
    expect(getInMemoryTemplates(ctx)).toEqual({})
    await Promise.all([
      triggerFileEvent('add', indexJson, jsonContent),
      triggerFileEvent('add', searchJson, jsonContent),
    ])
    // All templates:
    expect(getInMemoryTemplates(ctx)).toEqual({[indexJson]: jsonContent, [searchJson]: jsonContent})
    expect(getInMemoryTemplates(ctx, '/unknown')).toEqual({[indexJson]: jsonContent, [searchJson]: jsonContent})
    // Only index:
    expect(getInMemoryTemplates(ctx, '/')).toEqual({[indexJson]: jsonContent})
    expect(getInMemoryTemplates(ctx, '/index.html')).toEqual({[indexJson]: jsonContent})
    // Only search:
    expect(getInMemoryTemplates(ctx, '/search')).toEqual({[searchJson]: jsonContent})
    // Removed from memory after syncing:
    await nextTick()
    expect(getInMemoryTemplates(ctx)).toEqual({})

    // -- Filters templates by locale:
    const enLocale = 'locales/en.default.json'
    const enSchemaLocale = 'locales/en.default.schema.json'
    const esLocale = 'locales/es.json'
    const esSchemaLocale = 'locales/es.schema.json'
    expect(getInMemoryTemplates(ctx)).toEqual({})
    await Promise.all([
      triggerFileEvent('add', enLocale, jsonContent),
      triggerFileEvent('add', enSchemaLocale, jsonContent),
      triggerFileEvent('add', esLocale, jsonContent),
      triggerFileEvent('add', esSchemaLocale, jsonContent),
    ])
    // Unknown locale, uses default:
    expect(getInMemoryTemplates(ctx)).toEqual({[enLocale]: jsonContent, [enSchemaLocale]: jsonContent})
    expect(getInMemoryTemplates(ctx, undefined, 'unknown')).toEqual({
      [enLocale]: jsonContent,
      [enSchemaLocale]: jsonContent,
    })
    // Known locale with schemas:
    expect(getInMemoryTemplates(ctx, undefined, 'en')).toEqual({[enLocale]: jsonContent, [enSchemaLocale]: jsonContent})
    expect(getInMemoryTemplates(ctx, undefined, 'es')).toEqual({[esLocale]: jsonContent, [esSchemaLocale]: jsonContent})
    // Removed from memory after syncing:
    await nextTick()
    expect(getInMemoryTemplates(ctx)).toEqual({})

    // -- Promise resolves when connection is stopped:
    subscribeEvent.node.req.destroy()
    await expect(streamPromise).resolves.not.toThrow()
  })
})

// -- Test utilities --

function createH3Event(url: string) {
  const data: string[] = []
  const decoder = new TextDecoder()

  const socket = new Socket()
  const req = new IncomingMessage(socket)
  const res = new ServerResponse(req)
  // H3 checks `res.socket` for streaming
  Object.defineProperty(res, 'socket', {value: socket, writable: false})
  const resWrite = res.write.bind(res)
  res.write = (chunk) => {
    data.push(decoder.decode(chunk))
    return resWrite(chunk)
  }

  req.url = url
  const event = createEvent(req, res)

  return {event, data}
}

function createTestContext(options?: {files?: [string, string][]}) {
  /** Waits for an event stream to be flushed, or for the last `onSync` callback to be triggered */
  const nextTick = () => new Promise((resolve) => setTimeout(resolve))

  const localThemeExtensionFileSystem = emptyThemeExtFileSystem()
  const localThemeFileSystem = fakeThemeFileSystem('tmp', new Map())
  const upsertFile = (key: string, value: string) => {
    localThemeFileSystem.files.set(key, {checksum: '1', key, value})
    localThemeFileSystem.unsyncedFileKeys.add(key)
    // Sync the file after 2 ticks to simulate async operations:
    nextTick()
      .then(nextTick)
      .then(() => localThemeFileSystem.unsyncedFileKeys.delete(key))
      .catch(() => {})
  }

  options?.files?.forEach(([key, value]) => upsertFile(key, value))

  const addEventListenerSpy = vi.spyOn(localThemeFileSystem, 'addEventListener')

  /** Updates the fake file system and triggers events */
  const triggerFileEvent = async <T extends ThemeFSEventName>(event: T, fileKey: string, content = 'default-value') => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
    const handler = addEventListenerSpy.mock.calls.find(([eventName]) => eventName === event)?.[1]!
    const contentSpy = vi.fn((fn) => fn(content))
    const syncSpy = vi.fn((fn) => {
      // Waits 2 ticks to simulate async operations:
      nextTick()
        .then(nextTick)
        .then(fn)
        .catch(() => {})
    })

    const isUnlink = event === 'unlink'
    if (isUnlink) {
      localThemeFileSystem.files.delete(fileKey)
    } else {
      upsertFile(fileKey, content)
    }

    handler(isUnlink ? {fileKey, onSync: syncSpy} : {fileKey, onContent: contentSpy, onSync: syncSpy})

    // Waits for the event to be processed. Since we are using a tick here,
    // the previous async operations need to be deferred by at least 2 ticks.
    await nextTick()

    return isUnlink ? {syncSpy} : {contentSpy, syncSpy}
  }

  const ctx: DevServerContext = {
    session: {
      storefrontToken: '',
      token: '',
      storeFqdn: 'my-store.myshopify.com',
      sessionCookies: {},
    },
    localThemeFileSystem,
    localThemeExtensionFileSystem,
    directory: 'tmp',
    options: {
      ignore: [],
      only: [],
      noDelete: true,
      host: '',
      port: '',
      liveReload: 'hot-reload',
      open: false,
      themeEditorSync: false,
    },
  }

  /** Handles http events */
  const hotReloadHandler = getHotReloadHandler({id: 'my-theme-id'} as unknown as Theme, ctx)

  return {ctx, addEventListenerSpy, triggerFileEvent, nextTick, hotReloadHandler}
}
