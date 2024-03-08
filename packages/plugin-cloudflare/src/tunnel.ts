import {TUNNEL_PROVIDER} from './provider.js'
import install from './install-cloudflared.js'
import {
  startTunnel,
  TunnelError,
  TunnelStartReturn,
  TunnelStatusType,
  TunnelClient,
} from '@shopify/cli-kit/node/plugins/tunnel'
import {err, ok} from '@shopify/cli-kit/node/result'
import {exec, sleep} from '@shopify/cli-kit/node/system'
import {AbortController} from '@shopify/cli-kit/node/abort'
import {joinPath, dirname} from '@shopify/cli-kit/node/path'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {isUnitTest} from '@shopify/cli-kit/node/context/local'
import {BugError} from '@shopify/cli-kit/node/error'
import {Writable} from 'stream'
import {fileURLToPath} from 'url'

export default startTunnel({provider: TUNNEL_PROVIDER, action: hookStart})

// How much time to wait for a tunnel to be established. in seconds.
const TUNNEL_TIMEOUT = isUnitTest() ? 0.2 : 40

// if the tunnel process crashes, we'll retry this many times before giving up
// If we retry too many times, we might get rate limited by cloudflare
const MAX_RETRIES = 5

export async function hookStart(port: number): Promise<TunnelStartReturn> {
  try {
    const client = new TunnelClientInstance(port)
    await client.startTunnel()
    return ok(client)
    // eslint-disable-next-line no-catch-all/no-catch-all, @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const tunnelError = new TunnelError('unknown', error.message)
    return err(tunnelError)
  }
}

class TunnelClientInstance implements TunnelClient {
  port: number
  provider = TUNNEL_PROVIDER

  private currentStatus: TunnelStatusType = {status: 'not-started'}
  private abortController: AbortController | undefined = undefined

  constructor(port: number) {
    this.port = port
  }

  async startTunnel() {
    try {
      await install()
      this.tunnel()
      // eslint-disable-next-line no-catch-all/no-catch-all, @typescript-eslint/no-explicit-any
    } catch (error: any) {
      this.currentStatus = {status: 'error', message: error.message, tryMessage: whatToTry()}
    }
  }

  getTunnelStatus(): TunnelStatusType {
    return this.currentStatus
  }

  stopTunnel() {
    this.abortController?.abort()
  }

  tunnel(retries = 0) {
    this.abortController = new AbortController()
    let resolved = false

    if (retries >= MAX_RETRIES) {
      resolved = true
      this.currentStatus = {
        status: 'error',
        message: 'Could not start Cloudflare tunnel: max retries reached.',
        tryMessage: whatToTry(),
      }
      return
    }

    const args: string[] = ['tunnel', '--url', `http://localhost:${this.port}`, '--no-autoupdate']
    const errors: string[] = []

    let connected = false
    let url: string | undefined
    this.currentStatus = {status: 'starting'}

    setTimeout(() => {
      if (!resolved) {
        resolved = true
        const lastErrors = [...new Set(errors)].slice(-5).join('\n')
        if (lastErrors === '') {
          this.currentStatus = {
            status: 'error',
            message: 'Could not start Cloudflare tunnel: unknown error.',
            tryMessage: whatToTry(),
          }
        } else {
          this.currentStatus = {status: 'error', message: lastErrors, tryMessage: whatToTry()}
        }
        this.abortController?.abort()
      }
    }, TUNNEL_TIMEOUT * 1000)
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this

    const customStdout = new Writable({
      write(chunk, _, callback) {
        outputDebug(chunk.toString())
        if (resolved) return
        if (!url) url = findUrl(chunk)
        if (findConnection(chunk)) connected = true
        if (connected) {
          if (url) {
            resolved = true
            self.currentStatus = {status: 'connected', url}
          } else {
            self.currentStatus = {status: 'error', message: 'Could not start Cloudflare tunnel: URL not found.'}
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
      signal: this.abortController.signal,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      externalErrorHandler: async (error: any) => {
        if (error.message.includes('Unknown system error -86')) {
          // Cloudflare crashed because Rosetta 2 is not installed
          this.currentStatus = {
            status: 'error',
            message: `Could not start Cloudflare tunnel: Missing Rosetta 2.`,
            tryMessage: "Install it by running 'softwareupdate --install-rosetta' and try again",
          }
          return
        }
        // If already resolved, means that the CLI already received the tunnel URL.
        // Can't retry because the CLI is running with an invalid URL
        if (resolved) {
          throw new BugError(
            `Could not start Cloudflare tunnel: process crashed after stablishing a connection: ${error.message}`,
            whatToTry(),
          )
        }

        outputDebug(`Cloudflare tunnel crashed: ${error.message}, restarting...`)

        // wait 1 second before restarting the tunnel, to avoid rate limiting
        if (!isUnitTest()) await sleep(1)
        this.tunnel(retries + 1)
      },
    })
  }
}

function whatToTry() {
  return [
    'What to try:',
    {
      list: {
        items: [
          ['Run the command again'],
          ['Add the flag', {command: '--tunnel-url {URL}'}, 'to use a custom tunnel URL'],
        ],
      },
    },
  ]
}

function findUrl(data: Buffer): string | undefined {
  const regex = new RegExp(`(https:\\/\\/[^\\s]+\\.${getTunnelDomain()})`)
  const match = data.toString().match(regex) ?? undefined
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
    /ERR Failed to create new quic connection error/,
  ]
  const match = knownErrors.some((error) => error.test(data.toString()))
  if (!match) return undefined

  return `Could not start Cloudflare tunnel: ${cleanCloudflareLog(data.toString())}`
}

function cleanCloudflareLog(input: string): string {
  const prefixRegex = /^[0-9TZ:-]+ (ERR )?/g
  const suffixRegex = /connIndex.*/g
  return input.replace(prefixRegex, '').replace(suffixRegex, '')
}

function findConnection(data: Buffer): string | undefined {
  const match = data.toString().match(/(INF Registered tunnel connection|INF Connection)/) ?? undefined
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
