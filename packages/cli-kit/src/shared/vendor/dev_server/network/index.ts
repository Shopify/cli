import {spawnSync} from 'node:child_process'
import path from 'node:path'

export {getIpFromHosts} from './host.js'

export interface ConnectionArguments {
  projectName: string
  addr: string
  port: number
  timeout?: number
}

// eslint-disable-next-line prettier/prettier
const DEFAULT_CONNECT_TIMEOUT = 1000
// Skip initialization on module load to prevent Spin trying to load a macOS dylib
// (port checks should never run on Spin anyway)
let checkPort: ReturnType<typeof getCheckPortHelper>

export function assertConnectable(options: ConnectionArguments): void {
  checkPort ||= getCheckPortHelper()

  const {port, addr, timeout = DEFAULT_CONNECT_TIMEOUT} = options
  try {
    const normalizedAddr = addr === 'localhost' ? '127.0.0.1' : addr
    const running = checkPort(normalizedAddr, port, timeout)
    if (!running) {
      throw new Error(
        `DevServer for '${options.projectName}' is not running on ${port} / ${addr}: \`dev up ${options.projectName}\` to start it.`,
      )
    }
  } catch (err) {
    throw new Error(`DevServer check for '${options.projectName}' on ${port} / ${addr} failed (${err})`)
  }
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function TEST_testResetCheckPort(): void {
  checkPort = getCheckPortHelper()
}

function getCheckPortHelper(): (addr: string, port: number, timeout: number) => boolean {
  return fallbackCheckPort
}

function fallbackCheckPort(address: string, port: number, timeout: number): boolean {
  const result = spawnSync('nc', ['-z', '-w', '1', address, port.toString()], {
    timeout,
    stdio: 'ignore',
  })

  return result.status === 0
}
