import {getProxyStorefrontHeaders, patchRenderingResponse} from './proxy.js'
import {getInMemoryTemplates, injectHotReloadScript} from './hot-reload/server.js'
import {render} from './storefront-renderer.js'
import {getExtensionInMemoryTemplates} from '../theme-ext-environment/theme-ext-server.js'
import {logRequestLine} from '../log-request-line.js'
import {defineEventHandler, getCookie, setResponseHeader, setResponseStatus, type H3Error} from 'h3'
import {renderError, renderFatalError} from '@shopify/cli-kit/node/ui'
import {AbortError} from '@shopify/cli-kit/node/error'
import type {Response} from '@shopify/cli-kit/node/http'
import type {Theme} from '@shopify/cli-kit/node/themes/types'
import type {DevServerContext} from './types.js'

export function getHtmlHandler(theme: Theme, ctx: DevServerContext) {
  return defineEventHandler((event) => {
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
        logRequestLine(event, response)

        let html = await patchRenderingResponse(ctx, event, response)

        assertThemeId(response, html, String(theme.id))

        if (ctx.options.liveReload !== 'off') {
          html = injectHotReloadScript(html)
        }

        if (ctx.localThemeFileSystem.uploadErrors.size > 0) {
          html = injectErrorIntoHtml(html, ctx.localThemeFileSystem.uploadErrors)
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

function injectErrorIntoHtml(html: string, errors: Map<string, string[]>): string {
  const bodyIndex = html.indexOf('<body>')
  if (bodyIndex === -1) {
    return html + getErrorSection(errors)
  } else {
    const insertIndex = bodyIndex + '<body>'.length
    return html.slice(0, insertIndex) + getErrorSection(errors) + html.slice(insertIndex)
  }
}

function getErrorSection(errors: Map<string, string[]>) {
  const color = 'orangered'

  const errorContent = Array.from(errors.entries())
    .map(
      ([fileKey, messages]) => `
        <div style="margin-bottom: 16px; text-align: left;">
          <strong>${fileKey}</strong>
          ${messages
            .map((msg) => `<pre style="margin: 8px 0; white-space: normal; word-wrap: break-word;">- ${msg}</pre>`)
            .join('')}
        </div>
      `,
    )
    .join('')

  return `
    <div
      id="section-error-overlay"
      style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
      "
    >
      <div
        style="
          background: rgba(200, 200, 200, 0.9);
          backdrop-filter: blur(10px);
          border-radius: 10px;
          padding: 20px;
          font-family: system-ui, -apple-system, sans-serif;
          max-width: 80%;
          max-height: 80%;
          box-shadow: 0px 0px 10px rgba(0,0,0,0.5);
          position: relative;
        "
      >
        ${errorContent}
        <button
          style="
            position: absolute;
            top: 10px;
            right: 10px;
            background: transparent;
            border: none;
            font-size: 16px;
            cursor: pointer;
          "
          onclick="document.getElementById('section-error-overlay').style.display='none';"
        >
          &times;
        </button>
      </div>
    </div>
  `
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
