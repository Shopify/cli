import {TUNNEL_PROVIDER} from './provider.js'
import {startTunnel, TunnelError} from '@shopify/cli-kit/node/plugins/tunnel'
import {err, ok, Result} from '@shopify/cli-kit/node/result'
import {exec} from '@shopify/cli-kit/node/system'
import {joinPath, dirname} from '@shopify/cli-kit/node/path'
import {outputDebug} from '@shopify/cli-kit/node/output'
import {isUnitTest} from '@shopify/cli-kit/node/context/local'
import {Writable} from 'stream'
import {fileURLToPath} from 'url'

export default startTunnel({provider: TUNNEL_PROVIDER, action: hookStart})

export type ReturnType = Promise<Result<{url: string}, TunnelError>>

// How much time to wait for a tunnel to be established. in seconds.
const TUNNEL_TIMEOUT = isUnitTest() ? 0.2 : 20

export async function hookStart(port: number): ReturnType {
  try {
    const {url} = await tunnel({port})
    return ok({url})
    // eslint-disable-next-line no-catch-all/no-catch-all, @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const tunnelError = new TunnelError('unknown', error.message)
    return err(tunnelError)
  }
}

async function tunnel(options: {port: number}): Promise<{url: string}> {
  const args: string[] = ['tunnel', '--url', `http://localhost:${options.port}`, '--no-autoupdate']
  const errors: string[] = []

  let connected = false
  let resolved = false
  let url: string | undefined

  return new Promise<{url: string}>((resolve, reject) => {
    setTimeout(() => {
      if (!resolved) {
        resolved = true
        const lastErrors = errors.slice(-5).join('\n')
        reject(new Error(`Timed out while creating a cloudflare tunnel: ${lastErrors}`))
      }
    }, TUNNEL_TIMEOUT * 1000)

    const customStdout = new Writable({
      write(chunk, _, callback) {
        outputDebug(chunk.toString())
        if (resolved) return
        if (!url) url = findUrl(chunk)
        if (findConnection(chunk)) connected = true
        if (connected) {
          if (!url) return reject(new Error('A connection was established but no Tunnel URL was found'))
          resolved = true
          resolve({url})
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
    })
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
