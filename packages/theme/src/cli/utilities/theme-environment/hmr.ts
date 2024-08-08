// eslint-disable-next-line spaced-comment, @typescript-eslint/triple-slash-reference
/// <reference lib="dom" />
import {render} from './storefront-renderer.js'
import {DevServerContext} from './types.js'
import {createEventStream, defineEventHandler} from 'h3'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import {renderWarning} from '@shopify/cli-kit/node/ui'
import EventEmitter from 'node:events'

const eventEmitter = new EventEmitter()
const updatedReplaceTemplates = {} as {[key: string]: string}

type HmrEvent =
  | {
      type: 'section'
      key: string
      content: string
    }
  | {
      type: 'other'
      key: string
    }

function emitHmrEvent(event: HmrEvent) {
  eventEmitter.emit('hmr', event)
}

export function getReplaceTemplates() {
  return {...updatedReplaceTemplates}
}

export function setReplaceTemplate(key: string, content: string) {
  updatedReplaceTemplates[key] = content
}

export function deleteReplaceTemplate(key: string) {
  delete updatedReplaceTemplates[key]
}

export function getHmrHandler() {
  return defineEventHandler((event) => {
    if (event.path !== '/__hmr') return

    const eventStream = createEventStream(event)

    eventEmitter.on('hmr', (event: HmrEvent) => {
      eventStream.push(JSON.stringify(event)).catch((error: Error) => {
        renderWarning({headline: 'Failed to send HMR event.', body: error?.stack})
      })
    })

    return eventStream.send()
  })
}

export async function triggerHmr(theme: Theme, ctx: DevServerContext, key: string) {
  const sectionId = key.match(/^sections\/(.+)\.liquid$/)?.[1]

  if (!sectionId) {
    emitHmrEvent({type: 'other', key})
    return
  }

  const sectionTemplate = updatedReplaceTemplates[key]
  if (!sectionTemplate) {
    renderWarning({headline: 'No template found for HMR event.', body: `Template ${key} not found.`})
    return
  }

  const response = await render(ctx.session, {
    path: '/',
    query: [],
    themeId: String(theme.id),
    cookies: '',
    sectionId,
    headers: {},
    replaceTemplates: {[key]: sectionTemplate},
  })

  const content = await response.text()

  emitHmrEvent({type: 'section', key, content})
}

function injectFunction(fn: () => void) {
  return `<script>(${fn.toString()})()</script>`
}

export function injectFastRefreshScript(html: string) {
  // These function runs in the browser:

  function fastRefreshScript() {
    const evtSource = new EventSource('/__hmr', {withCredentials: true})

    evtSource.onopen = () => {
      // eslint-disable-next-line no-console
      console.info('[HMR] Connected')
    }

    evtSource.onmessage = (event) => {
      if (typeof event.data !== 'string') return

      const data = JSON.parse(event.data) as HmrEvent
      if (data.type === 'section') {
        const id = data.content.match(/id="([^"]+)"/)?.[1]
        if (id) {
          const existingElement = document.getElementById(id)
          if (existingElement) {
            existingElement.outerHTML = data.content
            // eslint-disable-next-line no-console
            console.info('[HMR] Updated section:', data.key)
          }
        }
      } else if (data.type === 'other') {
        // eslint-disable-next-line no-console
        console.info('[HMR] Full reload:', data.key)
        window.location.reload()
      }
    }
  }

  return html.replace(/<\/head>/, `${injectFunction(fastRefreshScript)}</head>`)
}
