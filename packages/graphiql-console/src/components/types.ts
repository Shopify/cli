export interface ServerStatus {
  serverIsLive: boolean
  appIsInstalled: boolean
  storeFqdn?: string
  appName?: string
  appUrl?: string
}
