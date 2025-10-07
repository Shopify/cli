import {decodeToml} from './toml.js'
import {findPathUp, readFile} from './fs.js'
import {cwd} from './path.js'
import * as metadata from './metadata.js'
import {renderWarning} from './ui.js'
import {JsonMap} from '../../private/common/json.js'

export interface Environments {
  [name: string]: JsonMap
}

interface LoadEnvironmentOptions {
  from?: string
  silent?: boolean
}

/**
 * Renders a warning message unless silent mode is enabled.
 * @param message - The warning message to render.
 * @param silent - Whether to suppress the warning.
 */
function renderWarningIfNeeded(message: Parameters<typeof renderWarning>[0], silent?: boolean): void {
  if (!silent) {
    renderWarning(message)
  }
}

/**
 * Loads environments from a file.
 * @param environmentName - The name of the environment.
 * @param fileName - The file name to load environments from.
 * @param options - Optional configuration for loading.
 * @returns The loaded environment.
 */
export async function loadEnvironment(
  environmentName: string,
  fileName: string,
  options?: LoadEnvironmentOptions,
): Promise<JsonMap | undefined> {
  const environments = await decodeEnvironments(fileName, options)
  if (!environments) {
    return undefined
  }

  const environment = environments[environmentName] as JsonMap | undefined

  if (!environment) {
    renderWarningIfNeeded(
      {
        body: ['Environment', {command: environmentName}, 'not found.'],
      },
      options?.silent,
    )
    return undefined
  }

  await metadata.addSensitiveMetadata(() => ({
    environmentFlags: JSON.stringify(environment),
  }))

  return environment
}

export async function environmentFilePath(
  fileName: string,
  options?: LoadEnvironmentOptions,
): Promise<string | undefined> {
  const basePath = options?.from && options.from !== '.' ? options.from : cwd()
  return findPathUp(fileName, {
    cwd: basePath,
    type: 'file',
  })
}

async function decodeEnvironments(fileName: string, options?: LoadEnvironmentOptions): Promise<JsonMap | undefined> {
  const filePath = await environmentFilePath(fileName, options)

  if (!filePath) {
    renderWarningIfNeeded({body: 'Environment file not found.'}, options?.silent)
    return undefined
  }

  const environmentsJson = decodeToml(await readFile(filePath)) as Environments
  const environments = environmentsJson.environments

  if (!environments) {
    renderWarningIfNeeded(
      {
        body: ['No environments found in', {command: filePath}, {char: '.'}],
      },
      options?.silent,
    )
    return undefined
  }

  return environments
}
