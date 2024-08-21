import {getClientScripts, HotReloadEvent} from './client.js'
import {render} from '../storefront-renderer.js'
import {patchRenderingResponse} from '../proxy.js'
import {createEventStream, defineEventHandler, getProxyRequestHeaders, getQuery, sendError, type H3Error} from 'h3'
import {renderWarning} from '@shopify/cli-kit/node/ui'
import {extname} from '@shopify/cli-kit/node/path'
import {parseJSON} from '@shopify/theme-check-node'
import EventEmitter from 'node:events'
import type {Theme, ThemeFSEventPayload} from '@shopify/cli-kit/node/themes/types'
import type {DevServerContext} from '../types.js'

// --- Template Replacers ---

/** Store which files are currently only updated in-memory, not in remote */
const inMemoryTemplateFiles = new Set<string>()
/** Store existing section names and types read from JSON files in the project */
const sectionNamesByFile = new Map<string, [string, string][]>()

function saveSectionsFromJson(fileKey: string, content: string) {
  const maybeJson = parseJSON(content, null)
  if (!maybeJson) return

  const sections: {[key: string]: {type: string}} = maybeJson?.sections

  sectionNamesByFile.set(
    fileKey,
    Object.entries(sections || {}).map(([name, {type}]) => [type, name]),
  )
}

/**
 * Gets all the modified files recorded in memory for `replaceTemplates` in the API.
 */
export function getInMemoryTemplates(ctx: DevServerContext) {
  const inMemoryTemplates: {[key: string]: string} = {}
  for (const fileKey of inMemoryTemplateFiles) {
    const content = ctx.localThemeFileSystem.files.get(fileKey)?.value
    if (content) inMemoryTemplates[fileKey] = content
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
    const needsTemplateUpdate = ['.liquid', '.json'].includes(extension)
    const isAsset = fileKey.startsWith('assets/')

    if (isAsset) {
      if (needsTemplateUpdate) {
        // If the asset is a .css.liquid or similar, we wait until it's been synced:
        onSync(() => triggerHotReload(fileKey, ctx))
      } else {
        // Otherwise, just full refresh directly:
        triggerHotReload(fileKey, ctx)
      }
    } else if (needsTemplateUpdate) {
      // Update in-memory templates for hot reloading:
      onContent((content) => {
        inMemoryTemplateFiles.add(fileKey)
        if (extension === '.json') saveSectionsFromJson(fileKey, content)
        triggerHotReload(fileKey, ctx)

        // Delete template from memory after syncing but keep
        // JSON values to read section names for hot-reloading sections.
        // -- Uncomment this when onSync is properly implemented
        // onSync(() => inMemoryTemplatesFiles.delete(fileKey))
      })
    }
  }

  ctx.localThemeFileSystem.addEventListener('add', handleFileUpdate)
  ctx.localThemeFileSystem.addEventListener('change', handleFileUpdate)
  ctx.localThemeFileSystem.addEventListener('unlink', ({fileKey, onSync}) => {
    onSync(() => {
      // Delete memory info after syncing with the remote instance because we
      // don't need to pass replaceTemplates anymore.
      inMemoryTemplateFiles.delete(fileKey)
      sectionNamesByFile.delete(fileKey)
    })
  })

  // Once the initial files are loaded, read all the JSON files so that
  // we gather the existing section names early. This way, when a section
  // is reloaded, we can quickly find what to update in the DOM without
  // spending time reading files.
  return ctx.localThemeFileSystem.ready().then(() => {
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
function emitHotReloadEvent(event: HotReloadEvent) {
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
      const queryParams = getQuery(event)
      const sectionId = queryParams['section-id']
      const sectionKey = queryParams['section-template-name']

      if (typeof sectionId !== 'string' || typeof sectionKey !== 'string') {
        return
      }

      const sectionTemplate =
        inMemoryTemplateFiles.has(sectionKey) && ctx.localThemeFileSystem.files.get(sectionKey)?.value

      if (!sectionTemplate) {
        renderWarning({headline: 'No template found for HotReload event.', body: `Template ${sectionKey} not found.`})
        return
      }

      const replaceTemplates = {[sectionKey]: sectionTemplate}

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
        path: '/',
        query: [],
        themeId: String(theme.id),
        sectionId,
        headers: getProxyRequestHeaders(event),
        replaceTemplates,
      })
        .then((response) => patchRenderingResponse(ctx, event, response))
        .catch(async (error: H3Error<{requestId?: string}>) => {
          const requestId = error.data?.requestId ?? ''
          let headline = `Failed to render section on Hot Reload.`
          if (requestId) headline += ` Request ID: ${requestId}`

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

  const sectionsToUpdate = new Set<string>()
  for (const [_fileKey, sections] of sectionNamesByFile) {
    for (const [type, name] of sections) {
      if (type === sectionId) {
        sectionsToUpdate.add(name)
      }
    }
  }

  emitHotReloadEvent({type: 'section', key, names: [...sectionsToUpdate]})
}

/**
 * Injects a `<script>` tag in the HTML Head containing
 * inlined code for HotReload.
 */
export function injectHotReloadScript(html: string) {
  return html.replace(/<\/head>/, `${getClientScripts()}</head>`)
}
