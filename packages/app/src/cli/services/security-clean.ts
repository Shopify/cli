import {appSecurityArtifactPaths, cleanAppSecurityArtifacts} from './app-security-artifacts.js'
import {renderInfo, renderSuccess} from '@shopify/cli-kit/node/ui'
import type {SecurityCleanResult} from './security-clean-json.js'

interface SecurityCleanOptions {
  appRoot: string
}

export interface SecurityCleanDependencies {
  cleanArtifacts(appRoot: string): Promise<string[]>
}

const defaultDependencies: SecurityCleanDependencies = {
  cleanArtifacts: cleanAppSecurityArtifacts,
}

/** Removes every current and legacy App Security artifact without asking. Prints nothing. */
export default async function securityClean(
  options: SecurityCleanOptions,
  dependencies: SecurityCleanDependencies = defaultDependencies,
): Promise<SecurityCleanResult> {
  const removed = await dependencies.cleanArtifacts(options.appRoot)
  return {removed}
}

/** Presents a clean result in the terminal. */
export function renderSecurityCleanResult(result: SecurityCleanResult, appRoot: string): void {
  if (result.removed.length === 0) {
    renderInfo({
      headline: 'No App Security artifacts to remove.',
      body: ['Nothing was found in', {filePath: appSecurityArtifactPaths(appRoot).artifactDirectory}],
    })
  } else {
    renderSuccess({
      headline: 'App Security artifacts removed.',
      body: {list: {items: result.removed.map((path) => ({filePath: path}))}},
    })
  }
}
