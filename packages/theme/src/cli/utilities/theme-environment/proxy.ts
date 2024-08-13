import {renderWarning} from '@shopify/cli-kit/node/ui'
import {defineEventHandler, proxyRequest, type H3Event} from 'h3'
import type {DevServerContext} from './types.js'

export function getProxyHandler(ctx: DevServerContext) {
  return defineEventHandler(async (event) => {
    if (event.method !== 'GET') {
      // Mock the well-known route to avoid errors
      return null
    }

    if (shouldProxyRequest(event)) {
      return proxyShopRequest(event, ctx)
    }
  })
}

export function replaceCdnProxy(content: string, ctx: DevServerContext) {
  const cdnPath = '/cdn/'
  const cdnRE = new RegExp(`(https?:)?//${ctx.session.storeFqdn.replace('.', '\\.')}${cdnPath}`, 'g')
  return content.replaceAll(cdnRE, cdnPath)
}

function shouldProxyRequest(event: H3Event) {
  const isHtmlRequest = event.headers.get('accept')?.includes('text/html')
  return !isHtmlRequest || event.path.startsWith('/wpm') || event.path.startsWith('/web-pixels-manager')
}

function proxyShopRequest(event: H3Event, ctx: DevServerContext) {
  const target = `https://${ctx.session.storeFqdn}${event.path}`
  const pathname = event.path.split('?')[0]!

  return proxyRequest(event, target, {
    headers: {referer: target},
    async onResponse(_, response) {
      if (!response.ok && response.status !== 404) {
        renderWarning({
          headline: `Failed to proxy request to ${pathname}`,
          body: `${response.status} - ${response.statusText}`,
        })
      }
    },
  }).catch((error) => {
    renderWarning({
      headline: `Failed to proxy request to ${pathname}`,
      body: error.stack ?? error.message,
    })
  })
}
