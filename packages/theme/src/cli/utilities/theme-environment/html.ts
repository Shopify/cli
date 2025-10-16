import {getProxyStorefrontHeaders, patchRenderingResponse, proxyStorefrontRequest} from './proxy.js'
import {getInMemoryTemplates, handleHotReloadScriptInjection} from './hot-reload/server.js'
import {render} from './storefront-renderer.js'
import {getErrorPage} from './hot-reload/error-page.js'
import {getExtensionInMemoryTemplates} from '../theme-ext-environment/theme-ext-server.js'
import {logRequestLine} from '../log-request-line.js'
import {extractFetchErrorInfo} from '../errors.js'
import {defineEventHandler, getCookie, type H3Event, type EventHandler} from 'h3'
import {renderError, renderFatalError} from '@shopify/cli-kit/node/ui'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {AbortError} from '@shopify/cli-kit/node/error'
import {recordEvent} from '@shopify/cli-kit/node/analytics'
import type {Theme} from '@shopify/cli-kit/node/themes/types'
import type {DevServerContext} from './types.js'

/** Tracks the number of consecutive theme ID mismatch redirects */
let themeIdMismatchRedirects = 0

/** The maximum number of consecutive theme ID mismatch redirects before aborting */
const MAX_THEME_ID_MISMATCH_REDIRECTS = 5

export function getHtmlHandler(theme: Theme, ctx: DevServerContext): EventHandler {
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
        if (response.status >= 400 && response.status < 500 && !isKnownRenderingRequest(event)) {
          // We have tried to render a route that can't be handled by SFR.
          // Ideally, this should be caught by `canProxyRequest` in `proxy.ts`,
          // but we can't be certain for all cases (e.g. an arbitrary app's route).
          // Fallback to proxying to see if that works:
          const proxyResponse = await tryProxyRequest(event, ctx, response)
          if (proxyResponse) {
            logRequestLine(event, proxyResponse, ctx)
            return proxyResponse
          }
        }

        logRequestLine(event, response, ctx)

        return patchRenderingResponse(ctx, response, (body) => {
          assertThemeId(response, body, String(theme.id))
          themeIdMismatchRedirects = 0
          return handleHotReloadScriptInjection(body, ctx)
        })
      })
      .catch(async (error) => {
        /**
         * Mismatch errors occur when the renderer regions change. In such rare
         * cases, the theme ID mismatch error happens, we gracefully refresh the
         * session, and redirect to the same page.
         */
        if (error instanceof ThemeIdMismatchError) {
          outputDebug(
            `Theme ID mismatch: expected ${error.getExpectedThemeId()} but got ${error.getActualThemeId()}; refreshing session...`,
          )

          recordEvent('theme-service:error-page:theme-id-mismatch')

          if (ctx.session.refresh) {
            themeIdMismatchRedirects++
            if (themeIdMismatchRedirects > MAX_THEME_ID_MISMATCH_REDIRECTS) {
              renderFatalError(new AbortError(error.getMessage()))
              process.exit(1)
            }

            await ctx.session.refresh()

            /**
             * Filtering out __sfr params to avoid infinite redirects, when in
             * development mode.
             */
            const searchParams = new URLSearchParams(browserSearch)
            const filteredParams = new URLSearchParams([...searchParams].filter(([key]) => !key.startsWith('__sfr')))
            const location = browserPathname + (filteredParams.toString() ? `?${filteredParams}` : '')

            return new Response(null, {
              status: 302,
              headers: {
                Location: location,
              },
            })
          }
        }

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
  const errorPageHtml = handleHotReloadScriptInjection(getErrorPage(options), ctx)

  recordEvent('theme-service:error-page:rendered')

  return new Response(errorPageHtml, {
    ...responseInit,
    headers: responseInit.headers ?? {'Content-Type': 'text/html; charset=utf-8'},
  })
}

/**
 * Detects routes and params that indicate this request should be handled by SFR.
 */
function isKnownRenderingRequest(event: H3Event) {
  const searchParams = new URLSearchParams(event.path.split('?')[1])
  return ['section_id', 'sections', 'app_block_id'].some((key) => searchParams.has(key))
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
    throw new ThemeIdMismatchError(expectedThemeId, obtainedThemeId, response)
  }
}

class ThemeIdMismatchError extends Error {
  private readonly response: Response
  private readonly expectedThemeId: string
  private readonly actualThemeId: string

  constructor(expectedThemeId: string, actualThemeId: string, response: Response) {
    super(
      [
        `Theme ID mismatch: expected ${expectedThemeId} but got ${actualThemeId}.`,
        `Request ID: ${response.headers.get('x-request-id')}`,
        `URL: ${response.url}`,
        'This is likely related to an issue in upstream Shopify APIs.',
        'Please try again in a few minutes and report this issue:',
        'https://community.shopify.dev/c/shopify-cli-libraries/14',
      ].join('\n'),
    )
    this.response = response
    this.expectedThemeId = expectedThemeId
    this.actualThemeId = actualThemeId
  }

  getMessage(): string {
    return this.message
  }

  getResponse(): Response {
    return this.response
  }

  getExpectedThemeId(): string {
    return this.expectedThemeId
  }

  getActualThemeId(): string {
    return this.actualThemeId
  }
}
