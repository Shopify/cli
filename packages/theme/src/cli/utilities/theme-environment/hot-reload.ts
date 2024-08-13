// eslint-disable-next-line spaced-comment, @typescript-eslint/triple-slash-reference
/// <reference lib="dom" />
import {render} from './storefront-renderer.js'
import {
  createEventStream,
  defineEventHandler,
  getProxyRequestHeaders,
  getQuery,
  removeResponseHeader,
  setResponseHeaders,
  setResponseStatus,
} from 'h3'
import {renderWarning} from '@shopify/cli-kit/node/ui'
import EventEmitter from 'node:events'
import type {Theme} from '@shopify/cli-kit/node/themes/types'
import type {DevServerContext} from './types.js'

interface TemplateWithSections {
  sections?: {[key: string]: {type: string}}
}

const eventEmitter = new EventEmitter()
const updatedReplaceTemplates = {} as {[key: string]: string}
const parsedJsonTemplates = {} as {[key: string]: TemplateWithSections}

type HotReloadEvent =
  | {
      type: 'section'
      key: string
      names: string[]
    }
  | {
      type: 'other'
      key: string
    }

function emitHotReloadEvent(event: HotReloadEvent) {
  eventEmitter.emit('hot-reload', event)
}

export function getReplaceTemplates() {
  return {...updatedReplaceTemplates}
}

export function setReplaceTemplate(key: string, content: string) {
  updatedReplaceTemplates[key] = content
  if (key.endsWith('.json')) {
    parsedJsonTemplates[key] = JSON.parse(content)
  }
}

export function deleteReplaceTemplate(key: string) {
  delete updatedReplaceTemplates[key]
  delete parsedJsonTemplates[key]
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

      const sectionTemplate = updatedReplaceTemplates[sectionKey]
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
      })

      setResponseStatus(event, response.status, response.statusText)
      setResponseHeaders(event, Object.fromEntries(response.headers.entries()))
      removeResponseHeader(event, 'content-encoding')

      return response.text()
    }
  })
}

export async function triggerHotReload(key: string) {
  const type = key.split('/')[0]

  if (type === 'sections') {
    await hotReloadSections(key)
  } else {
    emitHotReloadEvent({type: 'other', key})
  }
}

async function hotReloadSections(key: string) {
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

function injectFunction(fn: () => void) {
  return `<script>(${fn.toString()})()</script>`
}

export function injectHotReloadScript(html: string) {
  // These function run in the browser:

  function hotReloadScript() {
    // eslint-disable-next-line no-console
    const logInfo = console.info.bind(console, '[HotReload]')
    const evtSource = new EventSource('/__hot-reload/subscribe', {withCredentials: true})

    evtSource.onopen = () => logInfo('Connected')

    evtSource.onmessage = async (event) => {
      if (typeof event.data !== 'string') return

      const data = JSON.parse(event.data) as HotReloadEvent
      if (data.type === 'section') {
        const elements = data.names.flatMap((name) =>
          Array.from(document.querySelectorAll(`[id^='shopify-section'][id$='${name}']`)),
        )

        if (elements.length > 0) {
          await Promise.all(
            elements.map(async (element) => {
              const sectionId = element.id.replace(/^shopify-section-/, '')
              const response = await fetch(
                `/__hot-reload/render?section-id=${encodeURIComponent(
                  sectionId,
                )}&section-template-name=${encodeURIComponent(data.key)}`,
              )

              const updatedSection = await response.text()

              // SFR will send a header to indicate it used the replace-templates
              // to render the section. If it didn't, we need to do a full reload.
              if (response.headers.get('x-templates-from-params') === '1') {
                // eslint-disable-next-line require-atomic-updates
                element.outerHTML = updatedSection
              } else {
                logInfo('Full reload:', data.key)
                window.location.reload()
              }
            }),
          )

          logInfo(`Updated sections for "${data.key}":`, data.names)
        }
      } else if (data.type === 'other') {
        logInfo('Full reload:', data.key)
        window.location.reload()
      }
    }
  }

  return html.replace(/<\/head>/, `${injectFunction(hotReloadScript)}</head>`)
}
