import {TUNNEL_PROVIDER} from './provider.js'
import {startTunnel, TunnelError} from '@shopify/cli-kit/node/plugins/tunnel'
import {err, ok, Result} from '@shopify/cli-kit/node/result'
import {exec, captureOutput} from '@shopify/cli-kit/node/system'
import {joinPath, dirname} from '@shopify/cli-kit/node/path'
import {Writable} from 'stream'
import {fileURLToPath} from 'url'

export default startTunnel({provider: TUNNEL_PROVIDER, action: hookStart})

export type ReturnType = Promise<Result<{url: string}, TunnelError>>

export async function hookStart(port: number): ReturnType {
  try {
    const {url} = await tunnel({port})
    return ok({url})
    // eslint-disable-next-line no-catch-all/no-catch-all, @typescript-eslint/no-explicit-any
  } catch (error: any) {
    const tunnelError = new TunnelError('unknown', "Couldn't start tunnel")
    return err(tunnelError)
  }
}

async function tunnel(options: {port: number}): Promise<{url: string}> {
  /**
   * We append an empty config (--config "") to the command to prevent
   * cloudflared from reading the config file from the user home directory.
   * We want to use the free tier plugins, which is not compatible with custom configurations.
   *
   * In the future we'll explore a way to allow users to use their own cloudflare account.
   */
  const args: string[] = ['tunnel', '--url', `http://localhost:${options.port}`, '--config', '""']

  let connected = false
  let resolved = false
  let url: string | undefined

  return new Promise<{url: string}>((resolve, reject) => {
    const customStdout = new Writable({
      write(chunk, _, callback) {
        if (resolved) return
        if (!url) url = findUrl(chunk)
        if (findConnection(chunk)) connected = true
        if (url && connected) {
          resolved = true
          resolve({url})
        }
        if (findError(chunk)) reject(new Error("Couldn't start tunnel"))
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

export async function cloudflareVersion(): Promise<string> {
  return captureOutput(getBinPathTarget(), ['--version'])
}

function findUrl(data: Buffer): string | undefined {
  const match = data.toString().match(/\|\s+(https?:\/\/[^\s]+)/) ?? undefined
  return match && match[1]
}

function findError(data: Buffer): string | undefined {
  const match = data.toString().match(/ERR Couldn't start tunnel/) ?? undefined
  return match && match[0]
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
