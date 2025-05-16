import {
  getHotReloadHandler,
  getInMemoryTemplates,
  handleHotReloadScriptInjection,
  HOT_RELOAD_VERSION,
  hotReloadScriptId,
  hotReloadScriptUrl,
  setupInMemoryTemplateWatcher,
} from './server.js'
import {fakeThemeFileSystem} from '../../theme-fs/theme-fs-mock-factory.js'
import {render} from '../storefront-renderer.js'
import {emptyThemeExtFileSystem} from '../../theme-fs-empty.js'
import {describe, test, expect, vi} from 'vitest'
import {createEvent} from 'h3'
import {IncomingMessage, ServerResponse} from 'node:http'
import {Socket} from 'node:net'
import type {DevServerContext} from '../types.js'
import type {Theme, ThemeFSEventName} from '@shopify/cli-kit/node/themes/types'

vi.mock('../storefront-renderer.js')

const THEME_ID = 'my-theme-id'

describe('Hot Reload', () => {
  describe('handleHotReloadScriptInjection', () => {
    const htmlWithHrScript = `<html><head><script id="${hotReloadScriptId}" src="${hotReloadScriptUrl}" defer></script></head><body></body></html>`
    const htmlWithoutHrScript = '<html><head></head><body></body></html>'

    test('keeps the SFR injected script when hot reload is enabled', () => {
      const ctx = {
        options: {liveReload: 'hot-reload'},
      } as unknown as DevServerContext

      expect(handleHotReloadScriptInjection(htmlWithHrScript, ctx)).toEqual(htmlWithHrScript)
    })

    test('removes the SFR injected script when hot reload is disabled', () => {
      const ctx = {
        options: {liveReload: 'off'},
      } as unknown as DevServerContext

      expect(handleHotReloadScriptInjection(htmlWithHrScript, ctx)).toEqual(htmlWithoutHrScript)
    })

    test('injects the hot reload script if missing from SFR when hot reload is enabled', () => {
      const ctx = {
        options: {liveReload: 'hot-reload'},
      } as unknown as DevServerContext

      expect(handleHotReloadScriptInjection(htmlWithoutHrScript, ctx)).toEqual(htmlWithHrScript)
    })

    test('does not inject the hot reload script if missing from SFR when hot reload is disabled', () => {
      const ctx = {
        options: {liveReload: 'off'},
      } as unknown as DevServerContext

      expect(handleHotReloadScriptInjection(htmlWithoutHrScript, ctx)).toEqual(htmlWithoutHrScript)
    })
  })

  describe('server events', () => {
    test('handles hot reload events with proper data and syncing', async () => {
      const testSectionType = 'my-test'
      const testSectionFileKey = `sections/${testSectionType}.liquid`
      const templateKey = 'templates/index.json'
      const templateValue = {
        sections: {first: {type: testSectionType}, second: {type: testSectionType}},
      }

      const {ctx, addEventListenerSpy, triggerFileEvent, nextTick, hotReloadHandler} = createTestContext({
        files: [[templateKey, JSON.stringify(templateValue)]],
      })

      await setupInMemoryTemplateWatcher({id: THEME_ID} as unknown as Theme, ctx)
      const {event: subscribeEvent, data: hotReloadEvents} = createH3Event('/', {accept: 'text/event-stream'})
      const streamPromise = hotReloadHandler(subscribeEvent)
      await nextTick()

      // Initial connection setup
      expect(addEventListenerSpy).toHaveBeenCalledWith('add', expect.any(Function))
      expect(addEventListenerSpy).toHaveBeenCalledWith('change', expect.any(Function))
      expect(addEventListenerSpy).toHaveBeenCalledWith('unlink', expect.any(Function))
      expect(hotReloadEvents[0]).toMatch(
        `data: {"type":"open","pid":"${process.pid}","themeId":"${THEME_ID}","version":"${HOT_RELOAD_VERSION}"}`,
      )

      // Test section file update
      await triggerFileEvent('add', testSectionFileKey)
      expect(getInMemoryTemplates(ctx)).toEqual({[testSectionFileKey]: expect.any(String)})

      const expectedSectionEvent = `data: {"sync":"local","themeId":"${THEME_ID}","type":"update","key":"${testSectionFileKey}","payload":{"sectionNames":["first","second"],"replaceTemplates":${JSON.stringify(
        getInMemoryTemplates(ctx),
      )},"updatedFileParts":{"stylesheetTag":false,"javascriptTag":false}},"version":"${HOT_RELOAD_VERSION}"}`

      // Verify local sync event
      expect(hotReloadEvents.at(-1)).toMatch(expectedSectionEvent)

      // Wait for remote sync
      await nextTick()
      expect(hotReloadEvents.at(-1)).toMatch(expectedSectionEvent.replace('local', 'remote'))

      // Test section rendering
      vi.mocked(render).mockResolvedValue(
        new Response('<div><link href="https://my-store.myshopify.com/cdn/path/assets/file.css"></link></div>'),
      )
      const renderResponse = await hotReloadHandler(
        createH3Event(`/?section_id=123__first&section_key=${testSectionFileKey}&_fd=0&pb=0&custom=1&custom=2`).event,
      )

      expect(render).toHaveBeenCalledWith(
        ctx.session,
        expect.objectContaining({
          path: '/',
          sectionId: '123__first',
          replaceTemplates: getInMemoryTemplates(ctx),
          query: [
            ['custom', '1'],
            ['custom', '2'],
          ],
        }),
      )

      // Patches the rendering response:
      expect(renderResponse).toBeInstanceOf(Response)
      await expect((renderResponse as Response).text()).resolves.toEqual(
        '<div><link href="/cdn/path/assets/file.css"></link></div>',
      )

      // -- Deletes in-memory section after syncing
      await nextTick()
      expect(getInMemoryTemplates(ctx)).toEqual({})

      // -- Test template update --
      const newTemplateValue = JSON.stringify({
        sections: {first: {type: testSectionType}, second: {type: testSectionType}, third: {type: testSectionType}},
      })
      await triggerFileEvent('change', templateKey, newTemplateValue)

      expect(getInMemoryTemplates(ctx)).toEqual({[templateKey]: newTemplateValue})

      // Since this is a template, sectionNames will be empty (no sections to reload)
      const expectedTemplateEvent = `data: {"sync":"local","themeId":"${THEME_ID}","type":"update","key":"${templateKey}","payload":{"sectionNames":[],"replaceTemplates":${JSON.stringify(
        getInMemoryTemplates(ctx),
      )}},"version":"${HOT_RELOAD_VERSION}"}`

      // Verify local sync event for JSON update
      expect(hotReloadEvents.at(-1)).toMatch(expectedTemplateEvent)
      // Wait for remote sync
      await nextTick()
      expect(hotReloadEvents.at(-1)).toMatch(expectedTemplateEvent.replace('local', 'remote'))

      // -- Test section group update --
      const anotherSectionType = 'my-test-2'
      const sectionGroupKey = 'sections/header-group.json'
      const sectionGroupValue = JSON.stringify({
        sections: {first: {type: anotherSectionType}, second: {type: anotherSectionType}},
      })
      await triggerFileEvent('change', sectionGroupKey, sectionGroupValue)

      expect(getInMemoryTemplates(ctx)).toEqual({[sectionGroupKey]: sectionGroupValue})

      // Since this is a section group, sectionNames will contain all the section names
      const expectedSectionGroupEvent = `data: {"sync":"local","themeId":"${THEME_ID}","type":"update","key":"${sectionGroupKey}","payload":{"sectionNames":["first","second"],"replaceTemplates":${JSON.stringify(
        getInMemoryTemplates(ctx),
      )}},"version":"${HOT_RELOAD_VERSION}"}`

      // Verify local sync event for JSON update
      expect(hotReloadEvents.at(-1)).toMatch(expectedSectionGroupEvent)
      // Wait for remote sync
      await nextTick()
      expect(hotReloadEvents.at(-1)).toMatch(expectedSectionGroupEvent.replace('local', 'remote'))

      // -- Test section group file deletion and how it affects the section names --
      const anotherSectionKey = `sections/${anotherSectionType}.liquid`
      await triggerFileEvent('change', anotherSectionKey)
      // Section is referenced by section group, so it includes the section names:
      expect(hotReloadEvents.at(-1)).toMatch(
        `data: {"sync":"local","themeId":"${THEME_ID}","type":"update","key":"${anotherSectionKey}","payload":{"sectionNames":["first","second"],"replaceTemplates":${JSON.stringify(
          getInMemoryTemplates(ctx),
        )},"updatedFileParts":{"stylesheetTag":false,"javascriptTag":false}},"version":"${HOT_RELOAD_VERSION}"}`,
      )
      // Wait for remote sync
      await nextTick()

      await triggerFileEvent('unlink', sectionGroupKey)
      expect(hotReloadEvents.at(-1)).toMatch(
        `data: {"sync":"local","themeId":"${THEME_ID}","type":"delete","key":"${sectionGroupKey}","version":"${HOT_RELOAD_VERSION}"}`,
      )
      await nextTick()
      expect(hotReloadEvents.at(-1)).toMatch(
        `data: {"sync":"remote","themeId":"${THEME_ID}","type":"delete","key":"${sectionGroupKey}","version":"${HOT_RELOAD_VERSION}"}`,
      )

      // Since the section group JSON file was removed, the section file is not referenced anymore
      await triggerFileEvent('change', anotherSectionKey)
      expect(getInMemoryTemplates(ctx)).toEqual({[anotherSectionKey]: 'default-value'})
      const expectedUnreferencedSectionEvent = `data: {"sync":"local","themeId":"${THEME_ID}","type":"update","key":"${anotherSectionKey}","payload":{"sectionNames":[],"replaceTemplates":${JSON.stringify(
        getInMemoryTemplates(ctx),
      )},"updatedFileParts":{"stylesheetTag":false,"javascriptTag":false}},"version":"${HOT_RELOAD_VERSION}"}`
      expect(hotReloadEvents.at(-1)).toMatch(expectedUnreferencedSectionEvent)
      await nextTick()
      expect(hotReloadEvents.at(-1)).toMatch(expectedUnreferencedSectionEvent.replace('local', 'remote'))

      // -- Test CSS file updates --
      const cssFileKey = 'assets/style.css'
      await triggerFileEvent('add', cssFileKey)
      // It does not add assets to the in-memory templates:
      expect(getInMemoryTemplates(ctx)).toEqual({})
      const expectedCssEvent = `data: {"sync":"local","themeId":"${THEME_ID}","type":"update","key":"${cssFileKey}","payload":{"sectionNames":[],"replaceTemplates":{}},"version":"${HOT_RELOAD_VERSION}"}`
      expect(hotReloadEvents.at(-1)).toMatch(expectedCssEvent)
      // Wait for remote sync
      await nextTick()
      expect(hotReloadEvents.at(-1)).toMatch(expectedCssEvent.replace('local', 'remote'))

      // -- Test CSS Liquid file updates --
      const cssLiquidFileKey = 'assets/style.css.liquid'
      await triggerFileEvent('add', cssLiquidFileKey)
      // It does not add assets to the in-memory templates:
      expect(getInMemoryTemplates(ctx)).toEqual({})
      const expectedCssLiquidEvent = `data: {"sync":"local","themeId":"${THEME_ID}","type":"update","key":"${cssLiquidFileKey}","payload":{"sectionNames":[],"replaceTemplates":{}},"version":"${HOT_RELOAD_VERSION}"}`
      expect(hotReloadEvents.at(-1)).toMatch(expectedCssLiquidEvent)
      // Wait for remote sync
      await nextTick()
      expect(hotReloadEvents.at(-1)).toMatch(expectedCssLiquidEvent.replace('local', 'remote'))

      // -- Test other file types (e.g. JS) --
      const jsFileKey = 'assets/something.js'
      await triggerFileEvent('add', jsFileKey)
      const expectedJsEvent = `data: {"sync":"local","themeId":"${THEME_ID}","type":"update","key":"${jsFileKey}","payload":{"sectionNames":[],"replaceTemplates":{}},"version":"${HOT_RELOAD_VERSION}"}`
      expect(hotReloadEvents.at(-1)).toMatch(expectedJsEvent)
      // Wait for remote sync
      await nextTick()
      expect(hotReloadEvents.at(-1)).toMatch(expectedJsEvent.replace('local', 'remote'))

      // -- Test template filtering by route --
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

      // Test template filtering by locale
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
      expect(getInMemoryTemplates(ctx, undefined, 'en')).toEqual({
        [enLocale]: jsonContent,
        [enSchemaLocale]: jsonContent,
      })
      expect(getInMemoryTemplates(ctx, undefined, 'es')).toEqual({
        [esLocale]: jsonContent,
        [esSchemaLocale]: jsonContent,
      })
      // Removed from memory after syncing:
      await nextTick()
      expect(getInMemoryTemplates(ctx)).toEqual({})

      // Test connection close
      subscribeEvent.node.req.destroy()
      await expect(streamPromise).resolves.not.toThrow()
    })
  })
})

// -- Test utilities --

function createH3Event(url: string, headers?: {[key: string]: string}) {
  const data: string[] = []
  const decoder = new TextDecoder()

  const socket = new Socket()
  const req = new IncomingMessage(socket)
  req.headers = {...req.headers, ...headers}
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

  // Initialize files without auto-sync for initial setup
  options?.files?.forEach(([key, value]) => {
    localThemeFileSystem.files.set(key, {checksum: '1', key, value})
  })

  const addEventListenerSpy = vi.spyOn(localThemeFileSystem, 'addEventListener')

  /** Updates the fake file system and triggers events */
  const triggerFileEvent = async <T extends ThemeFSEventName>(event: T, fileKey: string, content = 'default-value') => {
    if (event === 'unlink') {
      localThemeFileSystem.files.delete(fileKey)
    } else {
      localThemeFileSystem.files.set(fileKey, {checksum: '1', key: fileKey, value: content})
      localThemeFileSystem.unsyncedFileKeys.add(fileKey)
      // Wait 1 tick for the event stream to be flushed,
      // then another tick to simulate the remote sync
      nextTick()
        .then(nextTick)
        .then(() => localThemeFileSystem.unsyncedFileKeys.delete(fileKey))
        .catch(() => {})
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
    const handler = addEventListenerSpy.mock.calls.find(([eventName]) => eventName === event)?.[1]!

    handler({
      fileKey,
      onContent: (fn) => fn(content),
      onSync: (fn) => {
        // Wait 1 tick for the event stream to be flushed,
        // then another tick to simulate the remote sync
        nextTick()
          .then(nextTick)
          .then(fn)
          .catch(() => {})
      },
    })

    // Waits for the event to be processed and flushed
    await nextTick()
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
      errorOverlay: 'default',
    },
  }

  /** Handles http events */
  const hotReloadHandler = getHotReloadHandler({id: THEME_ID} as unknown as Theme, ctx)

  return {ctx, addEventListenerSpy, triggerFileEvent, nextTick, hotReloadHandler}
}
