import {getProxyStorefrontHeaders, injectCdnProxy} from './proxy.js'
import {getInMemoryTemplates, injectHotReloadScript} from './hot-reload/server.js'
import {render} from './storefront-renderer.js'
import {
  defineEventHandler,
  setResponseHeaders,
  setResponseStatus,
  removeResponseHeader,
  sendWebResponse,
  type H3Error,
} from 'h3'
import {renderError} from '@shopify/cli-kit/node/ui'
import type {Theme} from '@shopify/cli-kit/node/themes/types'
import type {DevServerContext} from './types.js'

export function getHtmlHandler(theme: Theme, ctx: DevServerContext) {
  return defineEventHandler(async (event) => {
    const {path: urlPath, method, headers} = event

    // eslint-disable-next-line no-console
    console.log(`${method} ${urlPath}`)

    const response = await render(ctx.session, {
      path: urlPath,
      query: [],
      themeId: String(theme.id),
      cookies: headers.get('cookie') || '',
      sectionId: '',
      headers: getProxyStorefrontHeaders(event),
      replaceTemplates: getInMemoryTemplates(),
    }).catch(async (error: H3Error<{requestId?: string}>) => {
      const requestId = error.data?.requestId ?? ''
      const headline = `Failed to render storefront ${requestId}`
      renderError({headline, body: error.stack ?? error.message})
      await sendWebResponse(
        event,
        new Response(
          getErrorPage({
            title: headline,
            header: headline,
            message: error.message,
            code: error.stack?.replace(`${error.message}\n`, '') ?? '',
          }),
          {status: error.statusCode, headers: {'content-type': 'text/html'}},
        ),
      )
    })

    if (!response) return null

    setResponseStatus(event, response.status, response.statusText)

    const LinkHeader = response.headers.get('Link')
    setResponseHeaders(event, {
      ...Object.fromEntries(response.headers.entries()),
      Link: LinkHeader && injectCdnProxy(LinkHeader, ctx),
    })

    // We are decoding the payload here, remove the header:
    let html = await response.text()
    removeResponseHeader(event, 'content-encoding')

    html = patchBaseUrlAttributes(html, ctx)
    html = injectCdnProxy(html, ctx)

    if (ctx.options.liveReload !== 'off') {
      html = injectHotReloadScript(html)
    }

    return html
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

function patchBaseUrlAttributes(html: string, ctx: DevServerContext) {
  const newBaseUrl = `http://${ctx.options.host}:${ctx.options.port}`
  const dataBaseUrlRE = new RegExp(
    `data-base-url=["']((?:https?:)?//${ctx.session.storeFqdn.replace('.', '\\.')})[^"']*?["']`,
    'g',
  )

  return html.replaceAll(dataBaseUrlRE, (match, m1) => match.replace(m1, newBaseUrl))
}
