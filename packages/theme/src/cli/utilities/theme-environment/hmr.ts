import {render} from './storefront-renderer.js'
import {DevServerContext} from './types.js'
import {Theme} from '@shopify/cli-kit/node/themes/types'
import EventEmitter from 'node:events'

function createFastRefreshScript() {
  function fastRefreshScript() {
    console.log('fastRefreshScript')
  }

  return `<script>(${fastRefreshScript.toString()})()</script>`
}

export function injectFastRefreshScript(html: string) {
  return html.replace(/<\/head>/, `${createFastRefreshScript()}</head>`)
}

const updatedTemplates = {} as {[key: string]: string}
const eventEmitter = new EventEmitter()

export function getReplaceTemplates() {
  return {...updatedTemplates}
}

export async function hmrSection(theme: Theme, ctx: DevServerContext, key: string) {
  const sectionId = key.match(/^sections\/(.+)\.liquid$/)?.[1]
  if (!sectionId) return

  const response = await render(ctx.session, {
    path: '/',
    query: [],
    themeId: String(theme.id),
    cookies: '',
    sectionId,
    headers: {},
    replaceTemplates: {[key]: updatedTemplates[key]!},
  })

  const content = await response.text()
  console.log('content:', content, response.status, response.statusText, {
    key,
    sectionId,
  })

  eventEmitter.emit('request', {key, content})
}
