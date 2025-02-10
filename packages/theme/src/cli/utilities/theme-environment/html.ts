import {getProxyStorefrontHeaders, patchRenderingResponse, proxyStorefrontRequest} from './proxy.js'
import {getInMemoryTemplates, injectHotReloadScript} from './hot-reload/server.js'
import {render} from './storefront-renderer.js'
import {getErrorPage} from './hot-reload/error-page.js'
import {getExtensionInMemoryTemplates} from '../theme-ext-environment/theme-ext-server.js'
import {logRequestLine} from '../log-request-line.js'
import {extractFetchErrorInfo} from '../errors.js'
import {defineEventHandler, getCookie, type H3Event} from 'h3'
import {renderError, renderFatalError} from '@shopify/cli-kit/node/ui'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputDebug} from '@shopify/cli-kit/node/output'
import type {Theme} from '@shopify/cli-kit/node/themes/types'
import type {DevServerContext} from './types.js'

export function getHtmlHandler(theme: Theme, ctx: DevServerContext) {
  return defineEventHandler((event) => {
    const [browserPathname = '/', browserSearch = ''] = event.path.split('?')

    const shouldRenderUploadErrorPage =
      ctx.options.errorOverlay !== 'silent' && ctx.localThemeFileSystem.uploadErrors.size > 0

    if (shouldRenderUploadErrorPage) {
      return createErrorPageResponse(
        ctx,
        {status: 500, statusText: 'Internal Server Error'},
        {
          title: 'Failed to Upload Theme Files',
          header: 'Upload Errors',
          errors: Array.from(ctx.localThemeFileSystem.uploadErrors.entries()).map(([file, errors]) => ({
            message: file,
            code: errors.join('\n'),
          })),
        },
      )
    }

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
        if (response.status >= 400 && response.status < 500) {
          // We have tried to render a route that can't be handled by SFR.
          // Ideally, this should be caught by `canProxyRequest` in `proxy.ts`,
          // but we can't be certain for all cases (e.g. an arbitrary app's route).
          // Fallback to proxying to see if that works:
          const proxyResponse = await tryProxyRequest(event, ctx, response)
          if (proxyResponse) {
            logRequestLine(event, proxyResponse)
            return proxyResponse
          }
        }

        logRequestLine(event, response)

        return patchRenderingResponse(ctx, response, (body) => {
          assertThemeId(response, body, String(theme.id))
          return ctx.options.liveReload === 'off' ? body : injectHotReloadScript(body)
        })
      })
      .catch(async (error) => {
        const {status, statusText, cause, ...errorInfo} = extractFetchErrorInfo(error, 'Failed to render storefront')
        const [title, ...rest] = errorInfo.headline.split('\n') as [string, ...string[]]

        renderError(errorInfo)

        return createErrorPageResponse(
          ctx,
          {status, statusText},
          {
            title,
            header: title,
            errors: [
              {
                message: [...rest, cause.message].join('<br>'),
                code: cause.stack?.replace(`${cause.message}\n`, '') ?? '',
              },
            ],
          },
        )
      })
  })
}

function createErrorPageResponse(
  ctx: DevServerContext,
  responseInit: ResponseInit,
  options: Parameters<typeof getErrorPage>[0],
) {
  let html = getErrorPage(options)

  if (ctx.options.liveReload !== 'off') {
    html = injectHotReloadScript(html)
  }

  return new Response(html, {
    ...responseInit,
    headers: responseInit.headers ?? {'Content-Type': 'text/html; charset=utf-8'},
  })
}

async function tryProxyRequest(event: H3Event, ctx: DevServerContext, response: Response) {
  outputDebug(
    `Render failed for ${event.path} with ${response.status} (x-request-id: ${response.headers.get(
      'x-request-id',
    )}), trying proxy...`,
  )

  const proxyResponse = await proxyStorefrontRequest(event, ctx).catch(
    (error) => new Response(null, extractFetchErrorInfo(error)),
  )

  if (proxyResponse.status < 400) {
    outputDebug(`Proxy status: ${proxyResponse.status}. Returning proxy response.`)
    return proxyResponse
  } else {
    outputDebug(`Proxy status: ${proxyResponse.status}. Returning render error.`)
  }
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
