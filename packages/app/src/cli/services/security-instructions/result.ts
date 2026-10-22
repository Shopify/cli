import {appSecurityInstructionsJsonOutputSchema, type AppSecurityInstructionsResult} from './types.js'
import {appSecurityArtifactPaths} from '../app-security-artifacts.js'
import {renderAppSecurityInstructions, type AppSecurityInstructionsDelivery} from '../app-security-instructions.js'
import {projectAppSecurityApp, projectAppSecurityInstructions, projectAppSecurityPath} from '../app-security/result.js'
import {resultsKey, type AppSecuritySelection} from '../app-security-selection.js'
import {outputResult} from '@shopify/cli-kit/node/output'

interface SecurityInstructionsOptions {
  selection: AppSecuritySelection
  /** How the instructions were delivered. */
  delivery: AppSecurityInstructionsDelivery
}

/** Presents delivered instructions as JSON, or prints them or confirms their delivery in the terminal. */
export function renderSecurityInstructionsResult(
  instructions: string,
  options: SecurityInstructionsOptions,
  format: 'json' | 'text',
): void {
  if (format === 'json') {
    outputResult(appSecurityInstructionsJsonOutputSchema.encode(appSecurityInstructionsResult(instructions, options)))
    return
  }

  renderAppSecurityInstructions(instructions, options.delivery)
}

function appSecurityInstructionsResult(
  instructions: string,
  {selection, delivery}: SecurityInstructionsOptions,
): AppSecurityInstructionsResult {
  if (delivery.writePath) return {path: projectAppSecurityPath(delivery.writePath), format: 'markdown'}

  const {resultsDirectory} = appSecurityArtifactPaths(selection.appDirectory, resultsKey(selection))
  return {
    status: 'success',
    app: projectAppSecurityApp(selection),
    resultsDirectory: projectAppSecurityPath(resultsDirectory),
    instructions: projectAppSecurityInstructions(instructions, delivery),
  }
}
