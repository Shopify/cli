import {render} from '../storefront-renderer.js'
import {getExtensionInMemoryTemplates} from '../../theme-ext-environment/theme-ext-server.js'
import {patchRenderingResponse} from '../proxy.js'
import {createFetchError, extractFetchErrorInfo} from '../../errors.js'
import {inferLocalHotReloadScriptPath} from '../../theme-fs.js'
import {parseServerEvent} from '../server-utils.js'
import {
  createError,
  createEventStream,
  defineEventHandler,
  getProxyRequestHeaders,
  send,
  sendError,
  type EventHandler,
} from 'h3'
import {renderError, renderInfo, renderWarning} from '@shopify/cli-kit/node/ui'
import {extname, joinPath} from '@shopify/cli-kit/node/path'
import {parseJSON} from '@shopify/theme-check-node'
import {readFile} from '@shopify/cli-kit/node/fs'
import {NodeTypes, toLiquidHtmlAST, walk} from '@shopify/liquid-html-parser'
import EventEmitter from 'node:events'
import type {
  HotReloadEvent,
  HotReloadFileEvent,
  HotReloadOpenEvent,
  HotReloadFullEvent,
} from '@shopify/theme-hot-reload'
import type {Theme, ThemeAsset, ThemeFSEventPayload} from '@shopify/cli-kit/node/themes/types'
import type {DevServerContext} from '../types.js'

// --- Section tag content cache ---

interface TagContent {
  content: string
  changed: boolean
}

const liquidContentCache = new Map<
  string,
  {checksum: string; stylesheet: TagContent; javascript: TagContent; schema: TagContent}
>()

// --- Template Replacers ---

/** Store existing section names and types read from JSON files in the project */
const sectionNamesByFile = new Map<string, [string, string][]>()
interface SectionGroup {
  [key: string]: {type: string}
}

function saveSectionsFromJson(fileKey: string, content: string) {
  const maybeJson = parseJSON(content, null, true)
  if (!maybeJson) return

  const sections: SectionGroup | undefined = maybeJson?.sections

  if (sections && !fileKey.startsWith('locales/')) {
    sectionNamesByFile.set(
      fileKey,
      Object.entries(sections || {}).map(([name, {type}]) => [type, name]),
    )
  } else {
    sectionNamesByFile.delete(fileKey)
  }
}

function needsTemplateUpdate(fileKey: string) {
  return !fileKey.startsWith('assets/') && ['.liquid', '.json'].includes(extname(fileKey))
}

/**
 * Gets all the modified files recorded in memory for `replaceTemplates` in the API.
 * If a route is passed, it will filter out the templates that are not related to the route.
 */
export function getInMemoryTemplates(ctx: DevServerContext, currentRoute?: string, locale?: string) {
  const inMemoryTemplates: {[key: string]: string} = {}

  const jsonTemplateRE = /^templates\/.+\.json$/
  const filterTemplate = currentRoute
    ? `${joinPath('templates', currentRoute.replace(/^\//, '').replace(/\.html$/, '') || 'index')}.json`
    : ''
  const hasRouteTemplate = Boolean(currentRoute) && ctx.localThemeFileSystem.files.has(filterTemplate)

  const localeRE = /^locales\/.+\.json$/
  const hasLocale =
    Boolean(locale) &&
    (ctx.localThemeFileSystem.files.has(`locales/${locale}.json`) ||
      ctx.localThemeFileSystem.files.has(`locales/${locale}.default.json`))

  for (const fileKey of ctx.localThemeFileSystem.unsyncedFileKeys) {
    if (!needsTemplateUpdate(fileKey)) continue

    if (hasRouteTemplate && jsonTemplateRE.test(fileKey)) {
      // Filter out unused JSON templates for the current route. If we're not
      // sure about the current route's template, we send all (modified) JSON templates.
      if (fileKey !== filterTemplate) continue
    } else if (localeRE.test(fileKey)) {
      // Filter out unused locales for the sent cookie. If can't find the
      // current locale file, we send the default locale (and its schema file).
      if (hasLocale) {
        if (!fileKey.startsWith(`locales/${locale}.`)) continue
      } else if (!fileKey.includes('.default.')) continue
    }

    inMemoryTemplates[fileKey] = ctx.localThemeFileSystem.files.get(fileKey)?.value ?? ''
  }

  return inMemoryTemplates
}

/**
 * Watchs for file changes and updates in-memory templates, triggering
 * HotReload if needed.
 */
export function setupInMemoryTemplateWatcher(theme: Theme, ctx: DevServerContext) {
  const handleFileUpdate = ({fileKey, onContent, onSync}: ThemeFSEventPayload) => {
    const extension = extname(fileKey)

    onContent((content) => {
      if (!isAsset(fileKey) && needsTemplateUpdate(fileKey) && extension === '.json') {
        saveSectionsFromJson(fileKey, content)
      }

      triggerHotReload(theme, ctx, onSync, {
        type: 'update',
        key: fileKey,
        payload: collectReloadInfoForFile(fileKey, ctx),
      })
    })
  }

  const handleFileDelete = ({fileKey, onSync}: ThemeFSEventPayload<'unlink'>) => {
    sectionNamesByFile.delete(fileKey)
    triggerHotReload(theme, ctx, onSync, {type: 'delete', key: fileKey})
  }

  ctx.localThemeFileSystem.addEventListener('add', handleFileUpdate)
  ctx.localThemeFileSystem.addEventListener('change', handleFileUpdate)
  ctx.localThemeFileSystem.addEventListener('unlink', handleFileDelete)

  // Once the initial files are loaded, read all the JSON files so that
  // we gather the existing section names early. This way, when a section
  // is reloaded, we can quickly find what to update in the DOM without
  // spending time reading files.
  return ctx.localThemeFileSystem.ready().then(async () => {
    const files = [...ctx.localThemeFileSystem.files]
    return Promise.allSettled(
      files.map(async ([fileKey, file]) => {
        if (fileKey.endsWith('.json')) {
          const content = file.value ?? (await ctx.localThemeFileSystem.read(fileKey))
          if (content && typeof content === 'string') saveSectionsFromJson(fileKey, content)
        }
      }),
    )
  })
}

// --- SSE Hot Reload ---
export const HOT_RELOAD_VERSION = '1'
const eventEmitter = new EventEmitter()
function emitHotReloadEvent(
  event:
    | Omit<HotReloadOpenEvent, 'version'>
    | Omit<HotReloadFullEvent, 'version'>
    | Omit<HotReloadFileEvent, 'version'>,
) {
  eventEmitter.emit('hot-reload', {
    ...event,
    version: HOT_RELOAD_VERSION,
  })
}

/**
 * Adds endpoints to handle HotReload subscriptions and related events.
 */
export function getHotReloadHandler(theme: Theme, ctx: DevServerContext): EventHandler {
  return defineEventHandler((event) => {
    const isEventSourceConnection = event.headers.get('accept') === 'text/event-stream'
    const query = parseServerEvent(event).searchParams

    if (isEventSourceConnection) {
      const eventStream = createEventStream(event)

      eventEmitter.on('hot-reload', (event: HotReloadEvent) => {
        eventStream.push(JSON.stringify(event)).catch((error: Error) => {
          renderWarning({headline: 'Failed to send HotReload event.', body: error.stack})
        })
      })

      emitHotReloadEvent({type: 'open', pid: String(process.pid), themeId: String(theme.id)})

      return eventStream.send().then(() => eventStream.flush())
    }

    if (query.has('hr-log')) {
      const message = parseJSON(query.get('hr-log') ?? '', null) as null | {
        type: string
        headline: string
        body?: string
      }

      if (message) {
        message.headline = `[HotReload] ${message.headline}`

        if (message.type === 'error') {
          renderError(message)
        } else if (message.type === 'warn') {
          renderWarning(message)
        } else if (message.type === 'info') {
          renderInfo(message)
        } else {
          renderWarning({headline: `Unknown HotReload log type: ${message.type}`})
        }
      }

      return null
    }

    if (event.path === localHotReloadScriptEndpoint) {
      return readFile(inferLocalHotReloadScriptPath())
        .then((content) => send(event, content, 'application/javascript'))
        .catch((cause) => sendError(event, createError({cause})))
    }

    if (query.has('section_id') || query.has('app_block_id')) {
      const sectionKey = query.get('section_key') ?? ''
      const sectionId = query.get('section_id') ?? ''
      const appBlockId = query.get('app_block_id') ?? ''
      const browserPathname = event.path.split('?')[0] ?? ''
      const browserSearch = new URLSearchParams(query)
      browserSearch.delete('section_key')
      browserSearch.delete('section_id')
      browserSearch.delete('app_block_id')
      browserSearch.delete('_fd')
      browserSearch.delete('pb')

      if (sectionId === '' && appBlockId === '') {
        return
      }

      const replaceTemplates: {[key: string]: string} = {}

      if (sectionId) {
        const inMemoryTemplateFiles = ctx.localThemeFileSystem.unsyncedFileKeys

        if (inMemoryTemplateFiles.has(sectionKey)) {
          const sectionTemplate = ctx.localThemeFileSystem.files.get(sectionKey)?.value
          if (!sectionTemplate) {
            // If the section template is not found, it means that the section has been removed.
            // The remote version might not yet be synced so, instead of rendering it remotely,
            // which should return an empty section, we directly return the same thing here.
            return ''
          }

          replaceTemplates[sectionKey] = sectionTemplate
        }

        // If a JSON file changed locally and updated the ID of a section,
        // there's a chance the cloud won't know how to render a modified section ID.
        // Therefore, we gather all the locally updated JSON files that reference
        // the updated section ID and include them in replaceTemplates:
        for (const fileKey of inMemoryTemplateFiles) {
          if (fileKey.endsWith('.json')) {
            for (const [_type, name] of sectionNamesByFile.get(fileKey) ?? []) {
              // Section ID is something like `template_12345__<section-name>`:
              if (sectionId.endsWith(`__${name}`)) {
                const content = ctx.localThemeFileSystem.files.get(fileKey)?.value
                if (content) replaceTemplates[fileKey] = content
                continue
              }
            }
          }
        }
      }

      return render(ctx.session, {
        method: event.method,
        path: browserPathname ?? '/',
        query: [...browserSearch.entries()],
        themeId: String(theme.id),
        sectionId,
        appBlockId,
        replaceTemplates,
        headers: getProxyRequestHeaders(event),
        replaceExtensionTemplates: getExtensionInMemoryTemplates(ctx),
      })
        .then(async (response) => {
          if (!response.ok) throw createFetchError(response)

          return patchRenderingResponse(ctx, response)
        })
        .catch(async (error: Error) => {
          const {status, statusText, ...errorInfo} = extractFetchErrorInfo(
            error,
            'Failed to render section on Hot Reload',
          )

          if (!appBlockId) renderWarning(errorInfo)

          return new Response(null, {status, statusText})
        })
    }
  })
}

export const triggerBrowserFullReload = (themeId: number | string, key: string) =>
  emitHotReloadEvent({
    themeId: String(themeId),
    type: 'full',
    key,
  })

export function triggerHotReload(
  theme: Theme,
  ctx: DevServerContext,
  onSync: ThemeFSEventPayload['onSync'],
  event: Pick<HotReloadFileEvent, 'key' | 'type' | 'payload'>,
) {
  const fullReload = () => triggerBrowserFullReload(theme.id, event.key)

  if (ctx.options.liveReload === 'off') return
  if (ctx.options.liveReload === 'full-page') {
    onSync(fullReload)
    return
  }

  const themeId = String(theme.id)

  emitHotReloadEvent({sync: 'local', themeId, ...event})
  onSync(() => emitHotReloadEvent({sync: 'remote', themeId, ...event}), fullReload)
}

function findSectionNamesToReload(key: string, ctx: DevServerContext) {
  const sectionsToUpdate = new Set<string>()

  if (key.endsWith('.json')) {
    // Update section groups by reading the section names from the group JSON file.
    const content = ctx.localThemeFileSystem.files.get(key)?.value
    if (content) {
      const sections: SectionGroup | undefined = parseJSON(content, null, true)?.sections
      for (const sectionName of Object.keys(sections ?? {})) {
        sectionsToUpdate.add(sectionName)
      }
    }
  } else {
    // Update specific sections by reading the section names from the in-memory map.
    const sectionId = key.match(/^sections\/(.+)\.liquid$/)?.[1]
    if (sectionId) {
      for (const [_fileKey, sections] of sectionNamesByFile) {
        for (const [type, name] of sections) {
          if (type === sectionId) {
            sectionsToUpdate.add(name)
          }
        }
      }
    }
  }

  return [...sectionsToUpdate]
}

function collectReloadInfoForFile(key: string, ctx: DevServerContext) {
  const [type] = key.split('/')

  return {
    sectionNames: type === 'sections' ? findSectionNamesToReload(key, ctx) : [],
    replaceTemplates: needsTemplateUpdate(key) ? getInMemoryTemplates(ctx) : {},
    updatedFileParts: getUpdatedFileParts(key, ctx),
  }
}

export const hotReloadScriptId = 'hot-reload-client'
export const hotReloadScriptUrl = '/cdn/shopifycloud/theme-hot-reload/theme-hot-reload.js'
const hotReloadScriptRE = new RegExp(`<script id="${hotReloadScriptId}"[^>]*>[^<]*</script>`)
const localHotReloadScriptEndpoint = '/@shopify/theme-hot-reload'

/**
 * Injects a `<script>` tag in the HTML Head containing
 * inlined code for HotReload.
 */
export function handleHotReloadScriptInjection(html: string, ctx: DevServerContext) {
  if (ctx.options.liveReload === 'off') return html.replace(hotReloadScriptRE, '')

  if (process.env.SHOPIFY_CLI_LOCAL_HOT_RELOAD) {
    // When running locally, use the local script for easy development.
    return html
      .replace(hotReloadScriptRE, '')
      .replace(
        /<\/head>/,
        `<script id="${hotReloadScriptId}" src="${localHotReloadScriptEndpoint}" defer></script></head>`,
      )
  }

  if (html.includes(`<script id="${hotReloadScriptId}"`)) {
    // Already injected in SFR, do nothing
    return html
  }

  // Inject the HotReload script in the HTML Head
  return html.replace(
    /<\/head>/,
    `<script id="${hotReloadScriptId}" src="${hotReloadScriptUrl}" defer></script></head>`,
  )
}

function isAsset(key: string) {
  return key.startsWith('assets/')
}

function getUpdatedFileParts(key: string, ctx: DevServerContext) {
  const file = ctx.localThemeFileSystem.files.get(key)
  const validPrefixes = ['sections/', 'snippets/', 'blocks/']
  const isValidFileType = validPrefixes.some((prefix) => key.startsWith(prefix)) && key.endsWith('.liquid')

  if (!file || !isValidFileType) return undefined

  const fileDetails = getUpdateFileDetails(file)

  return {
    stylesheetTag: fileDetails.tags.stylesheet.changed,
    javascriptTag: fileDetails.tags.javascript.changed,
  }
}

function getUpdateFileDetails(file: ThemeAsset) {
  const cached = liquidContentCache.get(file.key)
  const cacheEntry = {
    checksum: file.checksum,
    stylesheet: {content: '', changed: false},
    javascript: {content: '', changed: false},
    schema: {content: '', changed: false},
  }

  if (cached?.checksum === file.checksum) {
    return cached
  }

  liquidContentCache.delete(file.key)

  if (!file.value) return cacheEntry

  walk(toLiquidHtmlAST(file.value), (node) => {
    if (node.type !== NodeTypes.LiquidRawTag) return

    if (node.name === 'stylesheet' || node.name === 'javascript' || node.name === 'schema') {
      const content = node.body.value
      const changed = !cached || content !== cached[node.name].content

      cacheEntry[node.name] = {content, changed}
    }
  })

  liquidContentCache.set(file.key, cacheEntry)

  return cacheEntry
}
