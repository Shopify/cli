import {EXTENSION_CDN_PREFIX, VANITY_CDN_PREFIX} from './theme-environment/proxy.js'
import {timestampDateFormat} from '../constants.js'
import {palette, paint} from '../ui/palette.js'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {H3Event} from 'h3'
import {extname} from '@shopify/cli-kit/node/path'

import type {DevServerContext} from './theme-environment/types.js'

const CHARACTER_TRUNCATION_LIMIT = 80

interface MinimalResponse {
  status: number
  headers: {get: (key: string) => string | null}
}

export function logRequestLine(event: H3Event, response: MinimalResponse, ctx: DevServerContext) {
  if (!shouldLog(event)) return
  if (ctx.type === 'theme-extension') return

  const truncatedPath =
    event.path.length > CHARACTER_TRUNCATION_LIMIT
      ? `${event.path.substring(0, CHARACTER_TRUNCATION_LIMIT)}...`
      : event.path
  const serverTiming = response.headers.get('server-timing')
  const requestDuration = serverTiming?.match(/cfRequestDuration;dur=([\d.]+)/)?.[1]
  const durationString = requestDuration ? `${Math.round(Number(requestDuration))}ms` : ''

  // Clean-columns layout, coloring baked into the string via chalk so the Ink
  // <Text> stays color-prop-free and the embedded ANSI passes through. Padding
  // is applied to the RAW text BEFORE coloring — ANSI escapes have string length
  // but zero display width, so padding a colored string would misalign columns.
  const time = paint(palette.subdued)(timestampDateFormat.format(new Date()))
  const method = paint(methodColor(event.method))(event.method.toUpperCase().padEnd(5))
  const status = getColorizeStatus(response.status)(String(response.status).padEnd(3))
  const path = truncatedPath
  const duration = durationString ? paint(palette.subdued)(durationString) : ''

  const message = `${time}  ${method}  ${status} ${path}${duration ? `  ${duration}` : ''}`

  // Opt-in per dev session: when the persistent Ink view's sink is present,
  // route the already-formatted (color-carrying) line into the log region
  // instead of writing raw bytes to stderr below the live view. Absent
  // (non-TTY dev path), keep the exact current outputInfo behavior.
  if (ctx.sink) {
    ctx.sink.log(message)
  } else {
    outputInfo(message)
  }
}

export function shouldLog(event: H3Event) {
  const ignoredPathPrefixes = [EXTENSION_CDN_PREFIX, VANITY_CDN_PREFIX, '/checkouts', '/payments']
  const ignoredExtensions = ['.js', '.css', '.json', '.map']

  if (ignoredPathPrefixes.some((prefix) => event.path.startsWith(prefix))) return false

  const [pathname] = event.path.split('?') as [string]
  const extension = extname(pathname)

  if (ignoredExtensions.includes(extension)) return false

  return true
}

function methodColor(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':
      return palette.methods.get
    case 'POST':
      return palette.methods.post
    case 'PUT':
    case 'PATCH':
      return palette.methods.put
    case 'DELETE':
      return palette.methods.delete
    default:
      return palette.methods.other
  }
}

function getColorizeStatus(status: number): (text: string) => string {
  if (status < 300) {
    return paint(palette.status.success)
  } else if (status < 400) {
    return paint(palette.status.redirect)
  } else {
    return paint(palette.status.error)
  }
}
