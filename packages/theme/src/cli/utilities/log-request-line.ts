/* eslint-disable @typescript-eslint/unbound-method */
import {EXTENSION_CDN_PREFIX, VANITY_CDN_PREFIX} from './theme-environment/proxy.js'
import {timestampDateFormat} from '../constants.js'
import {outputContent, outputInfo, outputToken} from '@shopify/cli-kit/node/output'
import {H3Event} from 'h3'
import {extname} from '@shopify/cli-kit/node/path'

const CHARACTER_TRUNCATION_LIMIT = 80

interface MinimalResponse {
  status: number
  headers: {get: (key: string) => string | null}
}

export function logRequestLine(event: H3Event, response: MinimalResponse) {
  if (!shouldLog(event)) return

  const truncatedPath =
    event.path.length > CHARACTER_TRUNCATION_LIMIT
      ? `${event.path.substring(0, CHARACTER_TRUNCATION_LIMIT)}...`
      : event.path
  const serverTiming = response.headers.get('server-timing')
  const requestDuration = serverTiming?.match(/cfRequestDuration;dur=([\d.]+)/)?.[1]
  const durationString = requestDuration ? `${Math.round(Number(requestDuration))}ms` : ''

  const statusColor = getColorizeStatus(response.status)

  const eventMethodAligned = event.method.padStart(6)

  outputInfo(
    outputContent`• ${timestampDateFormat.format(new Date())} Request ${outputToken.raw(
      '»',
    )} ${eventMethodAligned} ${statusColor(String(response.status))} ${truncatedPath} ${outputToken.gray(
      durationString,
    )}`,
  )
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

function getColorizeStatus(status: number) {
  if (status < 300) {
    return outputToken.green
  } else if (status < 400) {
    return outputToken.yellow
  } else {
    return outputToken.errorText
  }
}
