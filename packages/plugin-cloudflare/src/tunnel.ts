import {TUNNEL_PROVIDER} from './provider.js'
import {startTunnel, TunnelError, TunnelStatusType} from '@shopify/cli-kit/node/plugins/tunnel'
import {err} from '@shopify/cli-kit/node/result'
import {exec} from '@shopify/cli-kit/node/system'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {joinPath, dirname} from '@shopify/cli-kit/node/path'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {isUnitTest} from '@shopify/cli-kit/node/context/local'
import {Writable} from 'stream'
import {fileURLToPath} from 'url'

export default startTunnel({provider: TUNNEL_PROVIDER, action: hookStart})

// How much time to wait for a tunnel to be established. in seconds.
const TUNNEL_TIMEOUT = isUnitTest() ? 0.2 : 40

let currentStatus: TunnelStatusType = {status: 'not-started'}

export const getCurrentStatus = async () => currentStatus

const abortController = new AbortController()

export async function hookStart(port: number) {
  try {
    return tunnel({port})
    // eslint-disable-next-line no-catch-all/no-catch-all, @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const tunnelError = new TunnelError('unknown', error.message)
    return err(tunnelError)
  }
}

export async function stopCloudflareProcess() {
  abortController.abort()
}

function tunnel(options: {port: number}): void {
  const args: string[] = ['tunnel', '--url', `http://localhost:${options.port}`, '--no-autoupdate']
  const errors: string[] = []

  let connected = false
  let resolved = false
  let url: string | undefined
  currentStatus = {status: 'starting'}

  setTimeout(() => {
    if (!resolved) {
      resolved = true
      const lastErrors = errors.slice(-5).join('\n')
      currentStatus = {status: 'error', message: lastErrors}
    }
  }, TUNNEL_TIMEOUT * 1000)

  const customStdout = new Writable({
    write(chunk, _, callback) {
      outputDebug(chunk.toString())
      if (resolved) return
      if (!url) url = findUrl(chunk)
      if (findConnection(chunk)) connected = true
      if (connected) {
        if (url) {
          resolved = true
          currentStatus = {status: 'connected', url}
        } else {
          currentStatus = {status: 'error', message: 'Could not find tunnel url'}
        }
      }
      const errorMessage = findError(chunk)
      if (errorMessage) errors.push(errorMessage)
      callback()
    },
  })

  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  exec(getBinPathTarget(), args, {
    stdout: customStdout,
    stderr: customStdout,
    signal: abortController.signal,
  })
}

function findUrl(data: Buffer): string | undefined {
  const match = data.toString().match(/(https?:\/\/[^\s]+trycloudflare\.com)/) ?? undefined
  return match && match[1]
}

function findError(data: Buffer): string | undefined {
  const knownErrors = [
    /failed to request quick Tunnel/,
    /failed to unmarshal quick Tunnel/,
    /failed to parse quick Tunnel ID/,
    /failed to provision routing/,
    /ERR Couldn't start tunnel/,
    /ERR Failed to serve quic connection/,
  ]
  const match = knownErrors.some((error) => error.test(data.toString()))
  return match ? data.toString() : undefined
}

function findConnection(data: Buffer): string | undefined {
  const match = data.toString().match(/INF Connection/) ?? undefined
  return match && match[0]
}

/**
 * Get the path where the binary was installed.
 * If the environment variable SHOPIFY_CLI_CLOUDFLARED_PATH is set, use that.
 */
function getBinPathTarget() {
  if (process.env.SHOPIFY_CLI_CLOUDFLARED_PATH) {
    return process.env.SHOPIFY_CLI_CLOUDFLARED_PATH
  }
  return joinPath(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'bin',
    process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared',
  )
}

function getTunnelDomain() {
  return process.env.SHOPIFY_CLI_CLOUDFLARED_DOMAIN ?? 'trycloudflare.com'
}
