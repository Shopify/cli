import {getProxyStorefrontHeaders, patchRenderingResponse} from './proxy.js'
import {getInMemoryTemplates, injectHotReloadScript} from './hot-reload/server.js'
import {render} from './storefront-renderer.js'
import {getExtensionInMemoryTemplates} from '../theme-ext-environment/theme-ext-server.js'
import {defineEventHandler, getCookie, setResponseHeader, setResponseStatus, type H3Error} from 'h3'
import {renderError, renderFatalError} from '@shopify/cli-kit/node/ui'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {AbortError} from '@shopify/cli-kit/node/error'
import type {Response} from '@shopify/cli-kit/node/http'
import type {Theme} from '@shopify/cli-kit/node/themes/types'
import type {DevServerContext} from './types.js'

export function getHtmlHandler(theme: Theme, ctx: DevServerContext) {
  return defineEventHandler((event) => {
    outputInfo(`${event.method} ${event.path}`)

    const [browserPathname = '/', browserSearch = ''] = event.path.split('?')

    return render(ctx.session, {
      method: event.method,
      path: browserPathname,
      query: [...new URLSearchParams(browserSearch)],
      themeId: String(theme.id),
      sectionId: '',
      headers: getProxyStorefrontHeaders(event),
      replaceExtensionTemplates: getExtensionInMemoryTemplates(ctx),
      replaceTemplates: getInMemoryTemplates(ctx, browserPathname, getCookie(event, 'localization')?.toLowerCase()),
    })
      .then(async (response) => {
        let html = await patchRenderingResponse(ctx, event, response)

        assertThemeId(response, html, String(theme.id))

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
        let errorPageHtml = getErrorPage({
          title,
          header: title,
          message: [...rest, cause?.message ?? error.message].join('<br>'),
          code: error.stack?.replace(`${error.message}\n`, '') ?? '',
        })

        if (ctx.options.liveReload !== 'off') {
          errorPageHtml = injectHotReloadScript(errorPageHtml)
        }

        return errorPageHtml
      })
  })
}

function getErrorPage(options: {title: string; header: string; message: string; code: string}) {
  const html = String.raw

  return html`<html>
    <head>
      <title>${options.title ?? 'Unknown error'}</title>
    </head>
    <body
      id="full-error-page"
      style="display: flex; flex-direction: column; align-items: center; padding-top: 20px; font-family: Arial"
    >
      <h2>${options.header}</h2>
      <p>${options.message}</p>
      <pre>${options.code}</pre>
    </body>
  </html>`
}

function assertThemeId(response: Response, html: string, expectedThemeId: string) {
  /**
   * DOM example:
   *
   * ```
   * <script>var Shopify = Shopify || {};
   * Shopify.locale = "en";
   * Shopify.theme = {"name":"Development","id":143509762348,"theme_store_id":null,"role":"development"};
   * Shopify.theme.handle = "null";
   * ...;</script>
   * ```
   */
  const obtainedThemeId = html.match(/Shopify\.theme\s*=\s*{[^}]+?"id":\s*"?(\d+)"?(}|,)/)?.[1]

  if (obtainedThemeId && obtainedThemeId !== expectedThemeId) {
    renderFatalError(
      new AbortError(
        `Theme ID mismatch: expected ${expectedThemeId} but got ${obtainedThemeId}.` +
          `\nRequest ID: ${response.headers.get('x-request-id')}` +
          `\nURL: ${response.url}`,
        `This is likely related to an issue in upstream Shopify APIs.` +
          `\nPlease try again in a few minutes and report this issue:` +
          `\nhttps://github.com/Shopify/cli/issues/new?template=bug-report.yml`,
      ),
    )

    process.exit(1)
  }
}
