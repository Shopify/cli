import {content, token, debug} from './public/node/output.js'
import {CLI_KIT_VERSION} from './public/common/version.js'
import Conf, {Schema} from 'conf'

const migrations = {}

export interface CachedAppInfo {
  directory: string
  appId?: string
  title?: string
  orgId?: string
  storeFqdn?: string
  updateURLs?: boolean
  tunnelPlugin?: string
}

interface ConfSchema {
  appInfo: CachedAppInfo[]
  themeStore: string
  session: string
}

const schema = {
  appInfo: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        appId: {
          type: 'string',
        },
        orgId: {
          type: 'string',
        },
        storeFqdn: {
          type: 'string',
        },
      },
    },
  },
} as unknown as Schema<ConfSchema>

let _instance: CLIKitStore | undefined

export function cliKitStore() {
  if (!_instance) {
    _instance = new CLIKitStore({
      schema,
      migrations,
      projectName: 'shopify-cli-kit',
      projectVersion: CLI_KIT_VERSION,
    })
  }
  return _instance
}

export function getAppInfo(directory: string): CachedAppInfo | undefined {
  const store = cliKitStore()
  return store.getAppInfo(directory)
}

export function setAppInfo(options: {
  directory: string
  appId?: string
  title?: string
  storeFqdn?: string
  orgId?: string
  updateURLs?: boolean
  tunnelPlugin?: string
}): void {
  const store = cliKitStore()
  store.setAppInfo(options)
}

export function clearAppInfo(directory: string): void {
  const store = cliKitStore()
  store.clearAppInfo(directory)
}

export function getThemeStore(): string | undefined {
  const store = cliKitStore()
  return store.getThemeStore()
}

export function setThemeStore(themeStore: string): void {
  const store = cliKitStore()
  store.setThemeStore(themeStore)
}

export function getSession(): string | undefined {
  const store = cliKitStore()
  return store.getSession()
}

export function setSession(session: string): void {
  const store = cliKitStore()
  store.setSession(session)
}

export function removeSession(): void {
  const store = cliKitStore()
  store.removeSession()
}

export function clearAllAppInfo(): void {
  const store = cliKitStore()
  store.clearAllAppInfo()
}

export class CLIKitStore extends Conf<ConfSchema> {
  getAppInfo(directory: string): CachedAppInfo | undefined {
    debug(content`Reading cached app information for directory ${token.path(directory)}...`)
    const apps = this.get('appInfo') ?? []
    return apps.find((app: CachedAppInfo) => app.directory === directory)
  }

  setAppInfo(options: {
    directory: string
    appId?: string
    title?: string
    storeFqdn?: string
    orgId?: string
    updateURLs?: boolean
    tunnelPlugin?: string
  }): void {
    debug(content`Storing app information for directory ${token.path(options.directory)}:${token.json(options)}`)
    const apps = this.get('appInfo') ?? []
    const index = apps.findIndex((saved: CachedAppInfo) => saved.directory === options.directory)
    if (index === -1) {
      apps.push(options)
    } else {
      const app: CachedAppInfo = apps[index]!
      apps[index] = {
        directory: options.directory,
        appId: options.appId ?? app.appId,
        title: options.title ?? app.title,
        storeFqdn: options.storeFqdn ?? app.storeFqdn,
        orgId: options.orgId ?? app.orgId,
        updateURLs: options.updateURLs ?? app.updateURLs,
        tunnelPlugin: options.tunnelPlugin ?? app.tunnelPlugin,
      }
    }
    this.set('appInfo', apps)
  }

  clearAppInfo(directory: string): void {
    debug(content`Clearing app information for directory ${token.path(directory)}...`)
    const apps = this.get('appInfo') ?? []
    const index = apps.findIndex((saved: CachedAppInfo) => saved.directory === directory)
    if (index !== -1) {
      apps.splice(index, 1)
    }
    this.set('appInfo', apps)
  }

  clearAllAppInfo(): void {
    debug(content`Clearing all app information...`)
    this.set('appInfo', [])
  }

  getThemeStore(): string | undefined {
    debug(content`Getting theme store...`)
    return this.get('themeStore')
  }

  setThemeStore(themeStore: string): void {
    debug(content`Setting theme store...`)
    this.set('themeStore', themeStore)
  }

  getSession(): string | undefined {
    debug(content`Getting session store...`)
    return this.get('sessionStore')
  }

  setSession(session: string): void {
    debug(content`Setting session store...`)
    this.set('sessionStore', session)
  }

  removeSession(): void {
    debug(content`Removing session store...`)
    this.set('sessionStore', '')
  }
}
