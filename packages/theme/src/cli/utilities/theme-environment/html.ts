import {getProxyStorefrontHeaders, patchRenderingResponse} from './proxy.js'
import {getInMemoryTemplates, injectHotReloadScript} from './hot-reload/server.js'
import {render} from './storefront-renderer.js'
import {defineEventHandler, setResponseHeader, setResponseStatus, type H3Error} from 'h3'
import {renderError} from '@shopify/cli-kit/node/ui'
import type {Theme} from '@shopify/cli-kit/node/themes/types'
import type {DevServerContext} from './types.js'

export function getHtmlHandler(theme: Theme, ctx: DevServerContext) {
  return defineEventHandler((event) => {
    const {path: urlPath, method, headers} = event

    // eslint-disable-next-line no-console
    console.log(`${method} ${urlPath}`)

    return render(ctx.session, {
      path: urlPath,
      query: [],
      themeId: String(theme.id),
      cookies: headers.get('cookie') || '',
      sectionId: '',
      headers: getProxyStorefrontHeaders(event),
      replaceTemplates: getInMemoryTemplates(),
    })
      .then(async (response) => {
        let html = await patchRenderingResponse(event, response, ctx)

        if (ctx.options.liveReload !== 'off') {
          html = injectHotReloadScript(html)
        }

        return html
      })
      .catch(async (error: H3Error<{requestId?: string}>) => {
        const requestId = error.data?.requestId ?? ''
        let headline = `Failed to render storefront.`
        if (requestId) headline += ` Request ID: ${requestId}`
        renderError({headline, body: error.stack ?? error.message})

        setResponseStatus(event, error.statusCode ?? 502, error.statusMessage)
        setResponseHeader(event, 'Content-Type', 'text/html')

        return getErrorPage({
          title: headline,
          header: headline,
          message: error.message,
          code: error.stack?.replace(`${error.message}\n`, '') ?? '',
        })
      })
  })
}

function getErrorPage(options: {title: string; header: string; message: string; code: string}) {
  const html = String.raw

  return html`<html>
    <head>
      <title>${options.title ?? 'Unknown error'}</title>
    </head>
    <body style="display: flex; flex-direction: column; align-items: center; padding-top: 20px; font-family: Arial">
      <h2>${options.header}</h2>
      <p>${options.message}</p>
      <pre>${options.code}</pre>
    </body>
  </html>`
}
