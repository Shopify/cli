import fs from 'node:fs'

import type {HostOptions} from './types.js'
import {assertCompatibleEnvironment} from './env.js'

export function createServer(projectName: string) {
  return {
    host: (options: HostOptions = {}) => host(projectName, options),
    url: (options: HostOptions = {}) => url(projectName, options),
  }
}

function host(projectName: string, {nonstandardHostPrefix}: HostOptions = {}): string {
  assertCompatibleEnvironment()

  const services = fs.readdirSync('/run/ports2').filter((file) => file.endsWith(`--${projectName}`))
  if (services.length === 0) {
    throw new Error(`DevServer for '${projectName}' not present in this spin environment`)
  }

  // Spin mostly doesn't do alternative hostname prefixing for core.
  if (projectName === 'shopify') {
    const prefix = nonstandardHostPrefix?.replace(/[-_]dev[-_]api$/, '')

    return `${prefix}.${projectName}.${process.env.SPIN_FQDN}`
  }

  const match = new RegExp(`^(.+)${projectName}$`).exec(services[0]!)
  const organization = match ? match[1] : ''
  const spinPrefix = organization === 'shopify--' ? '' : `${organization}`

  return `${spinPrefix}${projectName}.${process.env.SPIN_FQDN}`
}

function url(projectName: string, options: HostOptions = {}) {
  return `https://${host(projectName, options)}`
}
