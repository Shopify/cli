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
  const basePath = options?.from && options.from !== '.' ? options.from : cwd()
  const filePath = await findPathUp(fileName, {
    cwd: basePath,
    type: 'file',
  })
  if (!filePath) {
    renderWarning({body: 'Environment file not found.'})
    return undefined
  }
  const environmentsJson = decodeToml(await readFile(filePath)) as Environments
  const environments = environmentsJson.environments
  if (!environments) {
    renderWarning({
      body: ['No environments found in', {command: filePath}, {char: '.'}],
    })
    return undefined
  }
  const environment = environments[environmentName] as JsonMap
  if (!environment)
    renderWarning({
      body: ['Environment', {command: environmentName}, 'not found.'],
    })

  await metadata.addSensitiveMetadata(() => ({
    environmentFlags: JSON.stringify(environment),
  }))

  return environment
}
