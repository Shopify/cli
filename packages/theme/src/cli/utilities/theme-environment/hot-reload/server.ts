import {getClientScripts, HotReloadEvent} from './client.js'
import {render} from '../storefront-renderer.js'
import {THEME_DEFAULT_IGNORE_PATTERNS, THEME_DIRECTORY_PATTERNS} from '../../theme-fs.js'
import {patchHtmlWithProxy} from '../proxy.js'
import {
  createEventStream,
  defineEventHandler,
  getProxyRequestHeaders,
  getQuery,
  removeResponseHeader,
  sendError,
  setResponseHeaders,
  setResponseStatus,
  type H3Error,
} from 'h3'
import {renderWarning} from '@shopify/cli-kit/node/ui'
import {extname, joinPath, relativePath} from '@shopify/cli-kit/node/path'
import {readFile} from '@shopify/cli-kit/node/fs'
import EventEmitter from 'node:events'
import type {Theme} from '@shopify/cli-kit/node/themes/types'
import type {DevServerContext} from '../types.js'

interface TemplateWithSections {
  sections?: {[key: string]: {type: string}}
}

const eventEmitter = new EventEmitter()
const inMemoryTemplates = {} as {[key: string]: string}
const parsedJsonTemplates = {} as {[key: string]: TemplateWithSections}

function emitHotReloadEvent(event: HotReloadEvent) {
  eventEmitter.emit('hot-reload', event)
}

export function getInMemoryTemplates() {
  return {...inMemoryTemplates}
}

function setInMemoryTemplate(key: string, content: string) {
  inMemoryTemplates[key] = content
  if (key.endsWith('.json')) {
    parsedJsonTemplates[key] = JSON.parse(content)
  }
}

function deleteInMemoryTemplate(key: string) {
  delete inMemoryTemplates[key]
  delete parsedJsonTemplates[key]
}

export async function setupTemplateWatcher(ctx: DevServerContext) {
  const {default: chokidar} = await import('chokidar')

  const directoriesToWatch = new Set(
    THEME_DIRECTORY_PATTERNS.map((pattern) => joinPath(ctx.directory, pattern.split('/').shift() ?? '')),
  )

  let initialized = false
  const getKey = (filePath: string) => relativePath(ctx.directory, filePath)
  const handleFileUpdate = (filePath: string) => {
    const key = getKey(filePath)
    const extension = extname(filePath)
    const needsTemplateUpdate = ['.liquid', '.json'].includes(extension)
    const isAsset = key.startsWith('assets/')

    if (needsTemplateUpdate && !isAsset) {
      // During initialization we only want to process
      // JSON files to cache their contents early
      if (initialized || extension === '.json') {
        readFile(filePath)
          .then((content) => {
            setInMemoryTemplate(key, content)
            triggerHotReload(key, ctx)
          })
          .catch((error) => renderWarning({headline: `Failed to read file ${filePath}: ${error.message}`}))
      }
    } else if (initialized && isAsset) {
      triggerHotReload(key, ctx)
    }
  }

  const watcher = chokidar
    .watch([...directoriesToWatch], {
      ignored: THEME_DEFAULT_IGNORE_PATTERNS,
      persistent: true,
      ignoreInitial: false,
    })
    .on('ready', () => (initialized = true))
    .on('add', handleFileUpdate)
    .on('change', handleFileUpdate)
    .on('unlink', (filePath) => deleteInMemoryTemplate(getKey(filePath)))

  return {stopWatcher: () => watcher.close()}
}

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

      return eventStream.send()
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
        const headline = `Failed to render section on Hot Reload ${requestId}`
        renderWarning({headline, body: error.stack ?? error.message})
        await sendError(event, error)
      })

      if (!response) return null

      setResponseStatus(event, response.status, response.statusText)
      setResponseHeaders(event, Object.fromEntries(response.headers.entries()))
      removeResponseHeader(event, 'content-encoding')

      return patchHtmlWithProxy(await response.text(), ctx)
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

export function injectHotReloadScript(html: string) {
  return html.replace(/<\/head>/, `${getClientScripts()}</head>`)
}
