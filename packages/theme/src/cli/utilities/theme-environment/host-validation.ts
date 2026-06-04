import {createError, defineEventHandler, sendError} from 'h3'
import * as os from 'node:os'

function createAllowedHostsSet(host: string, port: number): Set<string> {
  const allowedHosts = new Set<string>()
  const portSuffix = `:${port}`
  const normalizedHost = host.toLowerCase().trim()

  allowedHosts.add(`${normalizedHost}${portSuffix}`)

  // When binding to localhost variants or 0.0.0.0, allow all localhost forms
  const localhostVariants = ['localhost', '127.0.0.1', '::1', '0.0.0.0']
  if (localhostVariants.includes(normalizedHost)) {
    allowedHosts.add(`localhost${portSuffix}`)
    allowedHosts.add(`127.0.0.1${portSuffix}`)
    allowedHosts.add(`[::1]${portSuffix}`)
  }

  // When binding to a wildcard address, the server is also reachable through the machine's
  // interface IPs (e.g. a LAN address like 192.168.x.x from another device on the network).
  if (normalizedHost === '0.0.0.0' || normalizedHost === '::') {
    for (const interfaces of Object.values(os.networkInterfaces())) {
      for (const iface of interfaces ?? []) {
        const address = iface.address.toLowerCase().split('%')[0]
        const isIPv6 = iface.family === 'IPv6'
        const formatted = isIPv6 ? `[${address}]` : address
        allowedHosts.add(`${formatted}${portSuffix}`)
      }
    }
  }

  return allowedHosts
}

function normalizeHostHeader(hostHeader: string | undefined): string | undefined {
  if (!hostHeader) return undefined
  // Lowercase, then strip trailing dot before port (or at end for plain hostname).
  // IPv6 brackets: trailing dot would be after `]`, e.g. [::1].:9292
  return hostHeader.toLowerCase().replace(/\.(?=:\d|$)/, '')
}

/**
 * Creates an h3 event handler that validates the request's Host header
 * against an allowlist of configured host/port and localhost variants.
 *
 * Used to mitigate DNS rebinding attacks on local dev servers.
 *
 * Returns a 400 Bad Request when the Host header is missing or not in the allowlist.
 */
export function createHostValidationHandler(host: string, port: number) {
  const allowedHosts = createAllowedHostsSet(host, port)

  return defineEventHandler((event) => {
    const hostHeader = event.node.req.headers.host
    const normalizedHost = normalizeHostHeader(hostHeader)

    if (!normalizedHost || !allowedHosts.has(normalizedHost)) {
      return sendError(
        event,
        createError({
          statusCode: 400,
          statusMessage: 'Bad Request',
          message: 'Invalid Host header',
        }),
      )
    }
  })
}
