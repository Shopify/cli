import {getProxyStorefrontHeaders, patchRenderingResponse} from './proxy.js'
import {getInMemoryTemplates, injectHotReloadScript} from './hot-reload/server.js'
import {render} from './storefront-renderer.js'
import {defineEventHandler, setResponseHeader, setResponseStatus, type H3Error} from 'h3'
import {renderError} from '@shopify/cli-kit/node/ui'
import type {Theme} from '@shopify/cli-kit/node/themes/types'
import type {DevServerContext} from './types.js'

export function getHtmlHandler(theme: Theme, ctx: DevServerContext) {
  return defineEventHandler((event) => {
    const {path: urlPath, method} = event

    // eslint-disable-next-line no-console
    console.log(`${method} ${urlPath}`)

    return render(ctx.session, {
      path: urlPath,
      query: [],
      themeId: String(theme.id),
      sectionId: '',
      headers: getProxyStorefrontHeaders(event),
      replaceTemplates: getInMemoryTemplates(ctx),
    })
      .then(async (response) => {
        let html = await patchRenderingResponse(ctx, event, response)

        if (ctx.options.liveReload !== 'off') {
          html = injectHotReloadScript(html)
        }

        return html
      })
      .catch(async (error: H3Error<{requestId?: string; url?: string}>) => {
        let headline = `Failed to render storefront with status ${error.statusCode} (${error.statusMessage}).`
        if (error.data?.requestId) headline += `\nRequest ID: ${error.data.requestId}`
        if (error.data?.url) headline += `\nURL: ${error.data.url}`

        const cause = error.cause as undefined | Error
        renderError({headline, body: cause?.stack ?? error.stack ?? error.message})

        setResponseStatus(event, error.statusCode ?? 502, error.statusMessage)
        setResponseHeader(event, 'Content-Type', 'text/html')

        const [title, ...rest] = headline.split('\n') as [string, ...string[]]
        return getErrorPage({
          title,
          header: title,
          message: [...rest, error.message].join('<br>'),
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
