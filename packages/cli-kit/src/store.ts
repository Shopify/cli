import schema from './store/schema'
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
  activeStore: string
  appInfo: CachedAppInfo[]
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
  } else {
    const app: CachedAppInfo = apps[index]
    apps[index] = {appId, storeFqdn: data.storeFqdn ?? app.storeFqdn, orgId: data.orgId ?? app.orgId}
  }
  cliKit.set('appInfo', apps)
}
