import fs from 'node:fs'

import * as ni from 'network-interfaces'

import type {HostOptions} from './types.js'
import {assertConnectable, getIpFromHosts} from './network/index.js'
import {assertCompatibleEnvironment} from './env.js'

const NON_SHOP_PREFIXES = ['app', 'dev', 'shopify']
const BACKEND_PORT = 8080

export function createServer(projectName: string) {
  return {
    host: (options: HostOptions = {}) => host(projectName, options),
    url: (options: HostOptions = {}) => url(projectName, options),
  }
}

function host(projectName: string, options: HostOptions = {}): string {
  assertCompatibleEnvironment()
  ;(assertRunningOverride || assertRunning2024)(projectName)

  const prefix = (options.nonstandardHostPrefix || projectName).replace(/_/g, '-')

  if (projectName === 'shopify') {
    if (prefix.endsWith('-dev-api')) {
      const shopName = prefix.replace('-dev-api', '')
      return `${shopName}.dev-api.shop.dev`
    }
    if (!NON_SHOP_PREFIXES.includes(prefix)) {
      return `${prefix}.my.shop.dev`
    }
  }
  return `${prefix}.shop.dev`
}

function url(projectName: string, options: HostOptions = {}): string {
  return `https://${host(projectName, options)}`
}

function assertRunning2024(projectName: string): void {
  console.log('HERE', projectName)
  assertConnectable({
    projectName,
    addr: getBackendIp(projectName),
    port: BACKEND_PORT,
  })
}

function getBackendIp(projectName: string): string {
  try {
    const backendIp = resolveBackendHost(projectName)
    ni.fromIp(backendIp, {internal: true, ipVersion: 4})

    return backendIp
  } catch (error) {
    throw new Error(`DevServer for '${projectName}' is not running: \`dev up ${projectName}\` to start it.`)
  }
}

function resolveBackendHost(name: string): string {
  let host: string
  try {
    host = fs.readlinkSync(`/opt/nginx/etc/manifest/${name}/current`)
  } catch (error) {
    host = `${name}.root.shopify.dev.internal`
  }

  try {
    return getIpFromHosts(host)
  } catch {
    return host
  }
}

// Allow overrides for more concise test setup. Meh.
let assertRunningOverride: typeof assertRunning2024 | undefined

export function setAssertRunning(override: typeof assertRunningOverride) {
  assertRunningOverride = override
}
