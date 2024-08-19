import {getClientScripts, HotReloadEvent} from './client.js'
import {render} from '../storefront-renderer.js'
import {patchRenderingResponse} from '../proxy.js'
import {createEventStream, defineEventHandler, getProxyRequestHeaders, getQuery, sendError, type H3Error} from 'h3'
import {renderWarning} from '@shopify/cli-kit/node/ui'
import {extname} from '@shopify/cli-kit/node/path'
import EventEmitter from 'node:events'
import type {Theme, ThemeFSEvent} from '@shopify/cli-kit/node/themes/types'
import type {DevServerContext} from '../types.js'

// --- Template Replacers ---

interface TemplateWithSections {
  sections?: {[key: string]: {type: string}}
}

const inMemoryTemplates = {} as {[key: string]: string}
const parsedJsonTemplates = {} as {[key: string]: TemplateWithSections}

/**
 * Gets all the modified files recorded in memory for `replaceTemplates` in the API.
 */
export function getInMemoryTemplates() {
  return {...inMemoryTemplates}
}

/**
 * Watchs for file changes and updates in-memory templates, triggering
 * HotReload if needed.
 */
export function setupInMemoryTemplateWatcher(ctx: DevServerContext) {
  const handleFileDelete = ({fileKey, syncPromise}: ThemeFSEvent<'unlink'>['payload'], deleteJsonValue = true) => {
    syncPromise
      .then(() => {
        // Delete memory info after syncing with the remote instance because we
        // don't need to pass replaceTemplates anymore.
        delete inMemoryTemplates[fileKey]
        if (deleteJsonValue) delete parsedJsonTemplates[fileKey]
      })
      .catch(() => {})
  }

  const handleFileUpdate = ({fileKey, contentPromise, syncPromise}: ThemeFSEvent<'add'>['payload']) => {
    const extension = extname(fileKey)
    const needsTemplateUpdate = ['.liquid', '.json'].includes(extension)
    const isAsset = fileKey.startsWith('assets/')

    if (needsTemplateUpdate && !isAsset) {
      contentPromise
        .then((content) => {
          inMemoryTemplates[fileKey] = content
          if (extension === '.json') parsedJsonTemplates[fileKey] = JSON.parse(content)
          triggerHotReload(fileKey, ctx)

          // Delete template from memory after syncing but keep
          // JSON values to read section names for hot-reloading sections.
          return handleFileDelete({fileKey, syncPromise}, false)
        })
        .catch(() => {})
    } else if (isAsset) {
      // No need to wait for anything, just full refresh
      triggerHotReload(fileKey, ctx)
    }
  }

  ctx.localThemeFileSystem.addEventListener('add', handleFileUpdate)
  ctx.localThemeFileSystem.addEventListener('change', handleFileUpdate)
  ctx.localThemeFileSystem.addEventListener('unlink', handleFileDelete)

  return ctx.localThemeFileSystem.ready().then(() => {
    const files = [...ctx.localThemeFileSystem.files]
    return Promise.all(
      files.map(async ([fileKey, file]) => {
        if (fileKey.endsWith('.json')) {
          const content = file.value ?? ((await ctx.localThemeFileSystem.read(fileKey)) as string)
          if (content) parsedJsonTemplates[fileKey] = JSON.parse(content)
        }
      }),
    )
  })
}

// --- SSE Hot Reload ---

const eventEmitter = new EventEmitter()
function emitHotReloadEvent(event: HotReloadEvent) {
  eventEmitter.emit('hot-reload', event)
}

/**
 * Adds endpoints to handle HotReload subscriptions and related events.
 */
export function getHotReloadHandler(theme: Theme, ctx: DevServerContext) {
  return defineEventHandler(async (event) => {
    const endpoint = event.path.split('?')[0]

    if (endpoint === '/__hot-reload/subscribe') {
      const eventStream = createEventStream(event)

      eventEmitter.on('hot-reload', (event: HotReloadEvent) => {
        eventStream.push(JSON.stringify(event)).catch((error: Error) => {
          renderWarning({headline: 'Failed to send HotReload event.', body: error?.stack})
        })
      })

      eventStream.push(JSON.stringify({type: 'open', pid: String(process.pid)})).catch(() => {})

      return eventStream.send().then(() => eventStream.flush())
    } else if (endpoint === '/__hot-reload/render') {
      const queryParams = getQuery(event)
      const sectionId = queryParams['section-id']
      const sectionKey = queryParams['section-template-name']

      if (typeof sectionId !== 'string' || typeof sectionKey !== 'string') {
        return
      }

      const sectionTemplate = inMemoryTemplates[sectionKey]
      if (!sectionTemplate) {
        renderWarning({headline: 'No template found for HotReload event.', body: `Template ${sectionKey} not found.`})
        return
      }

      const response = await render(ctx.session, {
        path: '/',
        query: [],
        themeId: String(theme.id),
        cookies: event.headers.get('cookie') || '',
        sectionId,
        headers: getProxyRequestHeaders(event),
        replaceTemplates: {[sectionKey]: sectionTemplate},
      }).catch(async (error: H3Error<{requestId?: string}>) => {
        const requestId = error.data?.requestId ?? ''
        const cause = error.cause as undefined | Error
        const headline = `Failed to render section on Hot Reload ${requestId}`
        renderWarning({headline, body: cause?.stack ?? error.stack ?? error.message})
        await sendError(event, error)
      })

      if (!response) return null

      return patchRenderingResponse(event, response, ctx)
    }
  })
}

function triggerHotReload(key: string, ctx: DevServerContext) {
  if (ctx.options.liveReload === 'off') return
  if (ctx.options.liveReload === 'full-page') {
    return emitHotReloadEvent({type: 'full', key})
  }

  const type = key.split('/')[0]

  if (type === 'sections') {
    hotReloadSections(key)
  } else if (type === 'assets' && key.endsWith('.css')) {
    emitHotReloadEvent({type: 'css', key})
  } else {
    emitHotReloadEvent({type: 'full', key})
  }
}

function hotReloadSections(key: string) {
  const sectionId = key.match(/^sections\/(.+)\.liquid$/)?.[1]
  if (!sectionId) return

  const sectionsToUpdate: string[] = []
  for (const {sections} of Object.values(parsedJsonTemplates)) {
    for (const [name, {type}] of Object.entries(sections || {})) {
      if (type === sectionId) {
        sectionsToUpdate.push(name)
      }
    }
  }

  emitHotReloadEvent({type: 'section', key, names: sectionsToUpdate})
}

/**
 * Injects a `<script>` tag in the HTML Head containing
 * inlined code for HotReload.
 */
export function injectHotReloadScript(html: string) {
  return html.replace(/<\/head>/, `${getClientScripts()}</head>`)
}
