import fs from 'node:fs'

import {createServer as createServer2024} from './dev-server-2024.js'
import {createServer as createServer2016} from './dev-server-2016.js'
import type {DevServer as DevServerType, DevServerCore as DevServerCoreType, HostOptions} from './types.js'

export {isDevServerEnvironment} from './env.js'

export class DevServer implements DevServerType {
  private readonly serverImpl: DevServerType

  constructor(private readonly projectName: string) {
    if (projectName === 'shopify') {
      throw new Error("Use `import {DevServerCore}` for the 'shopify' project")
    }
    this.serverImpl = inferProjectServer(projectName)
  }

  host(options?: HostOptions) {
    return this.serverImpl.host(options)
  }

  url(options?: HostOptions) {
    return this.serverImpl.url(options)
  }
}

export class DevServerCore implements DevServerCoreType {
  private readonly serverImpl: DevServerType

  constructor() {
    this.serverImpl = inferProjectServer('shopify')
  }

  host(prefix: string) {
    return this.serverImpl.host({nonstandardHostPrefix: prefix})
  }

  url(prefix: string) {
    return this.serverImpl.url({nonstandardHostPrefix: prefix})
  }
}

const INFERENCE_MODE_SENTINEL = '/opt/dev/misc/dev-server-inference-mode'

function inferProjectServer(projectName: string) {
  if (inferenceModeAndProjectIsEdition2016(projectName)) {
    return createServer2016(projectName)
  } else {
    return createServer2024(projectName)
  }
}

function inferenceModeAndProjectIsEdition2016(projectName: string): boolean {
  try {
    fs.accessSync(INFERENCE_MODE_SENTINEL)

    try {
      fs.accessSync(`/opt/nginx/etc/manifest/${projectName}/current/edition-2024`)
      return false
    } catch {
      return true
    }
  } catch {
    return false
  }
}
