import type {AppDeletionReadiness} from './teardown-orchestrator.js'

export interface AppManagementAppState {
  id: string
  key: string
  installCount?: number | null
  activeRelease: {version: {name: string}}
}

export function appDeletionReadinessFromApps(
  apps: AppManagementAppState[],
  appName: string,
  clientId?: string,
): AppDeletionReadiness {
  const exactNameMatches = apps.filter((app) => app.activeRelease.version.name === appName)
  const clientIdMatches = clientId ? exactNameMatches.filter((app) => app.key === clientId) : []
  const matchingApps = clientIdMatches.length > 0 ? clientIdMatches : exactNameMatches

  if (matchingApps.length === 0) return {status: 'already-deleted'}
  if (matchingApps.length > 1) {
    throw new Error(`App Management API returned multiple apps named ${appName}`)
  }

  const app = matchingApps[0]!
  if (typeof app.installCount !== 'number') {
    throw new Error(`App Management API did not return installCount for ${appName}`)
  }
  if (app.installCount === 0) {
    return {status: 'ready', app: {id: app.id, key: app.key}}
  }
  return {status: 'still-installed', installCount: app.installCount}
}
