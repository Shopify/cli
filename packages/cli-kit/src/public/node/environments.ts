import {TomlFile} from './toml/toml-file.js'
import {findPathUp} from './fs.js'
import {cwd} from './path.js'
import * as metadata from './metadata.js'
import {renderWarning} from './ui.js'
import {JsonMap} from '../../private/common/json.js'
import {minimatch} from 'minimatch'

export type Environments = Record<string, JsonMap>

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
 * Reads and parses the environments section from a TOML file.
 * Returns the environments record or undefined if the file or section is missing.
 */
async function decodeEnvironments(
  fileName: string,
  options?: LoadEnvironmentOptions,
): Promise<Environments | undefined> {
  const filePath = await environmentFilePath(fileName, options)
  if (!filePath) {
    renderWarningIfNeeded({body: 'Environment file not found.'}, options?.silent)
    return undefined
  }
  const file = await TomlFile.read(filePath)
  const environmentsJson = file.content as Environments
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
  return environments as Environments
}

export async function loadEnvironment(
  environmentName: string,
  fileName: string,
  options?: LoadEnvironmentOptions,
): Promise<JsonMap | undefined> {
  const environments = await decodeEnvironments(fileName, options)
  if (!environments) return undefined

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

/**
 * Returns all environment names defined in the TOML file.
 */
export async function getEnvironmentNames(
  fileName: string,
  options?: LoadEnvironmentOptions,
): Promise<string[]> {
  const environments = await decodeEnvironments(fileName, {silent: true, ...options})
  if (!environments) return []
  return Object.keys(environments)
}

/**
 * Expands glob patterns against all available environment names.
 * Literal (non-glob) names pass through unchanged via minimatch identity matching.
 * Warns for each pattern that matches nothing.
 */
export async function expandEnvironmentPatterns(
  patterns: string[],
  fileName: string,
  options?: LoadEnvironmentOptions,
): Promise<string[]> {
  const allNames = await getEnvironmentNames(fileName, options)
  if (allNames.length === 0) return []

  const matched = new Set<string>()
  for (const pattern of patterns) {
    const matches = allNames.filter((name) => minimatch(name, pattern))
    if (matches.length === 0) {
      renderWarningIfNeeded(
        {
          body: ['No environments matching', {command: pattern}, 'were found.'],
        },
        options?.silent,
      )
    }
    for (const match of matches) {
      matched.add(match)
    }
  }
  return Array.from(matched)
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
