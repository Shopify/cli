import {getClientScripts, HotReloadEvent} from './client.js'
import {render} from '../storefront-renderer.js'
import {patchRenderingResponse} from '../proxy.js'
import {getExtensionInMemoryTemplates} from '../../theme-ext-environment/theme-ext-server.js'
import {
  createError,
  createEventStream,
  defineEventHandler,
  getProxyRequestHeaders,
  getQuery,
  sendError,
  type H3Error,
} from 'h3'
import {renderWarning} from '@shopify/cli-kit/node/ui'
import {extname, joinPath} from '@shopify/cli-kit/node/path'
import {parseJSON} from '@shopify/theme-check-node'
import EventEmitter from 'node:events'
import type {Theme, ThemeFSEventPayload} from '@shopify/cli-kit/node/themes/types'
import type {DevServerContext} from '../types.js'

// --- Template Replacers ---

/** Store existing section names and types read from JSON files in the project */
const sectionNamesByFile = new Map<string, [string, string][]>()
interface SectionGroup {
  [key: string]: {type: string}
}

function saveSectionsFromJson(fileKey: string, content: string) {
  const maybeJson = parseJSON(content, null)
  if (!maybeJson) return

  const sections: SectionGroup | undefined = maybeJson?.sections

  if (sections) {
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
    ? `${joinPath('templates', currentRoute?.replace(/^\//, '').replace(/\.html$/, '') || 'index')}.json`
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
export function setupInMemoryTemplateWatcher(ctx: DevServerContext) {
  const handleFileUpdate = ({fileKey, onContent, onSync}: ThemeFSEventPayload) => {
    const extension = extname(fileKey)

    if (isAsset(fileKey)) {
      if (extension === '.liquid') {
        // If the asset is a .css.liquid or similar, we wait until it's been synced:
        onSync(() => triggerHotReload(fileKey.replace(extension, ''), ctx))
      } else {
        // Otherwise, just full refresh directly:
        triggerHotReload(fileKey, ctx)
      }
    } else if (needsTemplateUpdate(fileKey)) {
      // Update in-memory templates for hot reloading:
      onContent((content) => {
        if (extension === '.json') saveSectionsFromJson(fileKey, content)
        triggerHotReload(fileKey, ctx)
      })
    } else {
      // Unknown files outside of assets. Wait for sync and reload:
      onSync(() => triggerHotReload(fileKey, ctx))
    }
  }

  const handleFileDelete = ({fileKey, onSync}: ThemeFSEventPayload<'unlink'>) => {
    // Liquid assets are proxied, so we need to wait until the file has been deleted on the server before reloading
    const isLiquidAsset = isAsset(fileKey) && extname(fileKey) === '.liquid'
    if (isLiquidAsset) {
      onSync?.(() => {
        triggerHotReload(fileKey.replace('.liquid', ''), ctx)
      })
    } else {
      sectionNamesByFile.delete(fileKey)
      triggerHotReload(fileKey, ctx)
    }
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

const eventEmitter = new EventEmitter()
export function emitHotReloadEvent(event: HotReloadEvent) {
  eventEmitter.emit('hot-reload', event)
}

/**
 * Adds endpoints to handle HotReload subscriptions and related events.
 */
export function getHotReloadHandler(theme: Theme, ctx: DevServerContext) {
  return defineEventHandler((event) => {
    const endpoint = event.path.split('?')[0]

    if (endpoint === '/__hot-reload/subscribe') {
      const eventStream = createEventStream(event)

      eventEmitter.on('hot-reload', (event: HotReloadEvent) => {
        eventStream.push(JSON.stringify(event)).catch((error: Error) => {
          renderWarning({headline: 'Failed to send HotReload event.', body: error?.stack})
        })
      })

      eventStream
        .push(JSON.stringify({type: 'open', pid: String(process.pid)} satisfies HotReloadEvent))
        .catch(() => {})

      return eventStream.send().then(() => eventStream.flush())
    } else if (endpoint === '/__hot-reload/render') {
      const defaultQueryParams = {
        'app-block-id': '',
        'section-id': '',
        'section-template-name': '',
      }
      const {
        search: browserSearch,
        pathname: browserPathname,
        'app-block-id': appBlockId,
        'section-id': sectionId,
        'section-template-name': sectionKey,
      }: {[key: string]: string} = {...defaultQueryParams, ...getQuery(event)}

      if (sectionId === '' && appBlockId === '') {
        return
      }

      const replaceTemplates: {[key: string]: string} = {}
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
          for (const [_type, name] of sectionNamesByFile.get(fileKey) || []) {
            // Section ID is something like `template_12345__<section-name>`:
            if (sectionId.endsWith(`__${name}`)) {
              const content = ctx.localThemeFileSystem.files.get(fileKey)?.value
              if (content) replaceTemplates[fileKey] = content
              continue
            }
          }
        }
      }

      return render(ctx.session, {
        method: event.method,
        path: browserPathname ?? '/',
        query: [...new URLSearchParams(browserSearch).entries()],
        themeId: String(theme.id),
        sectionId,
        appBlockId,
        replaceTemplates,
        headers: getProxyRequestHeaders(event),
        replaceExtensionTemplates: getExtensionInMemoryTemplates(ctx),
      })
        .then(async (response) => {
          if (!response.ok) {
            throw createError({
              status: response.status,
              statusText: response.statusText,
              data: {requestId: response.headers.get('x-request-id'), url: response.url},
            })
          }

          return patchRenderingResponse(ctx, event, response)
        })
        .catch(async (error: H3Error<{requestId?: string; url?: string}>) => {
          let headline = `Failed to render section on Hot Reload with status ${error.statusCode} (${error.statusMessage}).`
          if (error.data?.requestId) headline += `\nRequest ID: ${error.data.requestId}`
          if (error.data?.url) headline += `\nURL: ${error.data.url}`

          const cause = error.cause as undefined | Error
          renderWarning({headline, body: cause?.stack ?? error.stack ?? error.message})

          await sendError(event, error)
          return null
        })
    }
  })
}

function triggerHotReload(key: string, ctx: DevServerContext) {
  if (ctx.options.liveReload === 'off') return
  if (ctx.options.liveReload === 'full-page') {
    return emitHotReloadEvent({type: 'full', key})
  }

  const [type] = key.split('/')

  if (type === 'sections') {
    hotReloadSections(key, ctx)
  } else if (type === 'assets' && key.endsWith('.css')) {
    emitHotReloadEvent({type: 'css', key})
  } else {
    emitHotReloadEvent({type: 'full', key})
  }
}

function hotReloadSections(key: string, ctx: DevServerContext) {
  const sectionsToUpdate = new Set<string>()

  if (key.endsWith('.json')) {
    // Update section groups by reading the section names from the group JSON file.
    const content = ctx.localThemeFileSystem.files.get(key)?.value
    if (content) {
      const sections: SectionGroup | undefined = parseJSON(content, null)?.sections
      for (const sectionName of Object.keys(sections || {})) {
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

  if (sectionsToUpdate.size > 0) {
    emitHotReloadEvent({type: 'section', key, names: [...sectionsToUpdate]})
  } else {
    emitHotReloadEvent({type: 'full', key})
  }
}

/**
 * Injects a `<script>` tag in the HTML Head containing
 * inlined code for HotReload.
 */
export function injectHotReloadScript(html: string) {
  return html.replace(/<\/head>/, `${getClientScripts()}</head>`)
}

function isAsset(key: string) {
  return key.startsWith('assets/')
}
