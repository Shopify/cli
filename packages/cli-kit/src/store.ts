import {content, token, debug} from './output.js'
import constants from './constants.js'
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

interface ActivePreset {
  directory: string
  preset: string
}

interface ConfSchema {
  appInfo: CachedAppInfo[]
  themeStore: string
  session: string
  activePresets: ActivePreset[]
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
  activePresets: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        directory: {
          type: 'string',
        },
        preset: {
          type: 'string'
        },
      },
    },
  }
} as unknown as Schema<ConfSchema>

let _instance: CLIKitStore | undefined

export async function cliKitStore() {
  if (!_instance) {
    // eslint-disable-next-line require-atomic-updates
    _instance = new CLIKitStore({
      schema,
      migrations,
      projectName: 'shopify-cli-kit',
      projectVersion: await constants.versions.cliKit(),
    })
  }
  return _instance
}

export async function getAppInfo(directory: string): Promise<CachedAppInfo | undefined> {
  const store = await cliKitStore()
  return store.getAppInfo(directory)
}

export async function setAppInfo(options: {
  directory: string
  appId?: string
  title?: string
  storeFqdn?: string
  orgId?: string
  updateURLs?: boolean
  tunnelPlugin?: string
}): Promise<void> {
  const store = await cliKitStore()
  store.setAppInfo(options)
}

export async function clearAppInfo(directory: string): Promise<void> {
  const store = await cliKitStore()
  store.clearAppInfo(directory)
}

export async function getActivePreset(directory: string): Promise<string | undefined> {
  const store = await cliKitStore()
  return store.getActivePreset(directory)
}

export async function setActivePreset(options: ActivePreset): Promise<void> {
  const store = await cliKitStore()
  store.setActivePreset(options)
}

export async function clearActivePreset(directory: string): Promise<void> {
  const store = await cliKitStore()
  store.clearActivePreset(directory)
}

export async function getThemeStore(): Promise<string | undefined> {
  const store = await cliKitStore()
  return store.getThemeStore()
}

export async function setThemeStore(themeStore: string): Promise<void> {
  const store = await cliKitStore()
  store.setThemeStore(themeStore)
}

export async function getSession(): Promise<string | undefined> {
  const store = await cliKitStore()
  return store.getSession()
}

export async function setSession(session: string): Promise<void> {
  const store = await cliKitStore()
  store.setSession(session)
}

export async function removeSession(): Promise<void> {
  const store = await cliKitStore()
  store.removeSession()
}

export async function clearAllAppInfo(): Promise<void> {
  const store = await cliKitStore()
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

  getActivePreset(directory: string): string | undefined {
    debug(content`Reading active preset for directory ${token.path(directory)}...`)
    const activePresets = this.get('activePresets') ?? []
    const activePreset = activePresets.find((info: ActivePreset) => info.directory === directory)
    return activePreset?.preset
  }

  setActivePreset(options: {
    directory: string
    preset: string
  }): void {
    debug(content`Storing active preset for directory ${token.path(options.directory)}:${token.yellow(options.preset)}`)
    const activePresets = this.get('activePresets') ?? []
    const index = activePresets.findIndex((saved: ActivePreset) => saved.directory === options.directory)
    if (index === -1) {
      activePresets.push(options)
    } else {
      const activePreset: ActivePreset = activePresets[index]!
      activePreset.preset = options.preset
    }
    this.set('activePresets', activePresets)
  }

  clearActivePreset(directory: string): void {
    debug(content`Clearing active preset for directory ${token.path(directory)}...`)
    const activePresets = this.get('activePresets') ?? []
    const index = activePresets.findIndex((saved: ActivePreset) => saved.directory === directory)
    if (index !== -1) {
      activePresets.splice(index, 1)
    }
    this.set('activePresets', activePresets)
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
