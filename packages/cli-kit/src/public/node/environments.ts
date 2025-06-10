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
 * Loads environments from a file.
 * @param dir - The file path to load environments from.
 * @returns The loaded environments.
 */
export async function loadEnvironment(
  environmentName: string,
  fileName: string,
  options?: LoadEnvironmentOptions,
): Promise<JsonMap | undefined> {
  const filePath = await environmentFilePath(fileName, options)
  if (!filePath) {
    if (!options?.silent) {
      renderWarning({body: 'Environment file not found.'})
    }
    return undefined
  }
  const environmentsJson = decodeToml(await readFile(filePath)) as Environments
  const environments = environmentsJson.environments
  if (!environments) {
    if (!options?.silent) {
      renderWarning({
        body: ['No environments found in', {command: filePath}, {char: '.'}],
      })
    }
    return undefined
  }
  const environment = environments[environmentName] as JsonMap | undefined

  if (!environment) {
    if (!options?.silent) {
      renderWarning({
        body: ['Environment', {command: environmentName}, 'not found.'],
      })
    }
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
