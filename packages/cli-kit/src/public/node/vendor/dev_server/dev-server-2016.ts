import fs from 'fs'
import * as os from 'node:os'

import {assertConnectable} from './network/index.js'
import {assertCompatibleEnvironment} from './env.js'
import {HostOptions} from './types.js'

export function createServer(projectName: string) {
  return {
    host: (options: HostOptions = {}) => host(projectName, options),
    url: (options: HostOptions = {}) => url(projectName, options),
  }
}

function host(projectName: string, options: HostOptions = {}): string {
  assertCompatibleEnvironment()
  ;(assertRunningOverride || assertRunning2016)(projectName)

  const prefix = options.nonstandardHostPrefix || projectName

  return `${prefix}.myshopify.io`
}

function url(projectName: string, options: HostOptions = {}): string {
  return `https://${host(projectName, options)}`
}

function assertRunning2016(projectName: string): void {
  const [addr, port] = getAddrPort(projectName)
  assertConnectable({projectName, addr, port})
}

function getAddrPort(name: string): [string, number] {
  try {
    const portContent = fs.readFileSync(`${os.homedir()}/.local/run/services/${name}/server/port`, 'utf-8')
    return ['localhost', parseInt(portContent, 10)]
  } catch (error) {
    throw new Error(`DevServer for '${name}' is not running: \`dev up ${name}\` to start it.`)
  }
}

// Allow overrides for more concise test setup. Meh.
let assertRunningOverride: typeof assertRunning2016 | undefined

export function setAssertRunning(override: typeof assertRunningOverride) {
  assertRunningOverride = override
}
