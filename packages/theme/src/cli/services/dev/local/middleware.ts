import {LocalDevServerContext} from './types.js'
import {ReloadTransport} from './reload-transport.js'
import {createHostValidationHandler} from '../../../utilities/theme-environment/host-validation.js'
import {defineEventHandler, getRequestHeaders, send, setResponseHeaders, setResponseStatus, type EventHandler} from 'h3'

/**
 * Validates the incoming `Host` header. Reuses the remote flow's handler so we
 * don't reinvent host validation (and stay consistent with its allow-list).
 */
export function hostValidationHandler(ctx: LocalDevServerContext): EventHandler {
  return createHostValidationHandler(ctx.host, ctx.port)
}

/**
 * Serves the rendered HTML by delegating to the render seam. The handler only
 * knows the `ThemeRenderer` interface — it has no idea whether the body came
 * from the hello-world draft or a future local Liquid renderer.
 */
export function renderHandler(ctx: LocalDevServerContext): EventHandler {
  return defineEventHandler(async (event) => {
    const path = event.path.split('?')[0] ?? '/'

    /* Track the last HTML path so keyboard shortcuts (e.g. open editor) can
       target it, mirroring the remote flow's `lastRequestedPath`. */
    ctx.lastRequestedPath = path

    const result = await ctx.renderer.render({
      path,
      method: event.method,
      headers: normalizeHeaders(getRequestHeaders(event)),
    })

    setResponseStatus(event, result.status)
    setResponseHeaders(event, result.headers)

    return send(event, result.body)
  })
}

/**
 * Builds the ordered middleware pipeline for the local dev server.
 *
 * Order matters and mirrors the remote flow: host validation runs first, then
 * the reload-transport SSE endpoint, then the catch-all render handler. Each
 * factory is independently testable.
 */
export function buildMiddleware(ctx: LocalDevServerContext, transport: ReloadTransport): EventHandler[] {
  return [hostValidationHandler(ctx), transport.handler, renderHandler(ctx)]
}

/**
 * h3's header bag can carry `string[]` (and `undefined`) values; the render
 * seam takes a flat `Record<string, string>`, so collapse them here.
 */
function normalizeHeaders(headers: Record<string, string | string[] | undefined>): Record<string, string> {
  const normalized: Record<string, string> = {}

  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) continue
    normalized[name] = Array.isArray(value) ? value.join(', ') : value
  }

  return normalized
}
