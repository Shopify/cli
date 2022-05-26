import cliKitPackageJson from '../package.json'
import Conf, {Schema} from 'conf'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore

const migrations = {}

export interface CachedAppInfo {
  directory: string
  appId: string
  title?: string
  orgId?: string
  storeFqdn?: string
}

interface ConfSchema {
  appInfo: CachedAppInfo[]
  themeStore: string
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

export const cliKit = new Conf<ConfSchema>({
  schema,
  migrations,
  projectName: 'shopify-cli-kit',
  projectVersion: cliKitPackageJson.version,
})

export function getAppInfo(directory: string): CachedAppInfo | undefined {
  const apps = cliKit.get('appInfo') ?? []
  return apps.find((app: CachedAppInfo) => app.directory === directory)
}

export function setAppInfo(options: {
  directory: string
  appId: string
  title?: string
  storeFqdn?: string
  orgId?: string
}): void {
  const apps = cliKit.get('appInfo') ?? []
  const index = apps.findIndex((saved: CachedAppInfo) => saved.directory === options.directory)
  if (index === -1) {
    apps.push(options)
  } else {
    const app: CachedAppInfo = apps[index]
    apps[index] = {
      appId: options.appId,
      directory: options.directory,
      title: options.title ?? app.title,
      storeFqdn: options.storeFqdn ?? app.storeFqdn,
      orgId: options.orgId ?? app.orgId,
    }
  }
  cliKit.set('appInfo', apps)
}

export function clearAppInfo(directory: string): void {
  const apps = cliKit.get('appInfo') ?? []
  const index = apps.findIndex((saved: CachedAppInfo) => saved.directory === directory)
  if (index !== -1) {
    apps.splice(index, 1)
  }
  cliKit.set('appInfo', apps)
}

export function getThemeStore(): string | undefined {
  return cliKit.get('themeStore')
}

export function setThemeStore(store: string): void {
  cliKit.set('themeStore', store)
}
