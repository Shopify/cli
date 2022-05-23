import schema from './store/schema'
import * as output from './output'
import cliKitPackageJson from '../package.json'
import Conf from 'conf'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore

const migrations = {}

export interface CachedAppInfo {
  appId: string
  orgId?: string
  storeFqdn?: string
}

interface ConfSchema {
  appInfo: CachedAppInfo[]
  themeStore: string
}

export const cliKit = new Conf<ConfSchema>({
  schema,
  migrations,
  projectName: 'shopify-cli-kit',
  projectVersion: cliKitPackageJson.version,
})

export function getAppInfo(appId: string): CachedAppInfo | undefined {
  const apps = cliKit.get('appInfo') ?? []
  return apps.find((app: any) => app.appId === appId)
}

export function setAppInfo(appId: string, data: {storeFqdn?: string; orgId?: string}): void {
  const apps = cliKit.get('appInfo') ?? []
  const index = apps.findIndex((saved: any) => saved.appId === appId)
  if (index === -1) {
    apps.push({appId, storeFqdn: data.storeFqdn, orgId: data.orgId})
    output.completed('Updated your project name to match your Shopify app name')
  } else {
    const app: CachedAppInfo = apps[index]
    apps[index] = {appId, storeFqdn: data.storeFqdn ?? app.storeFqdn, orgId: data.orgId ?? app.orgId}
  }
  cliKit.set('appInfo', apps)
}

export function clearAppInfo(appId: string): void {
  const apps = cliKit.get('appInfo') ?? []
  const index = apps.findIndex((saved: any) => saved.appId === appId)
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
