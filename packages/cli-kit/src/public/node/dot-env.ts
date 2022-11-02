import {AbortError} from './error.js'
import {exists, read as readFile, write as writeFile} from '../../file.js'
import {debug, content as outputContent, token} from '../../output.js'
import {parse, stringify} from 'envfile'

/**
 * Error that's thrown when the .env is not found.
 * @param path - Path to the .env file.
 * @returns An abort error.
 */
export const DotEnvNotFoundError = (path: string) => {
  return new AbortError(`The environment file at ${path} does not exist.`)
}

/**
 * This interface represents a .env file.
 */
export interface DotEnvFile {
  /**
   * Path to the .env file.
   */
  path: string
  /**
   * Variables of the .env file.
   */
  variables: {[name: string]: string}
}

/**
 * Reads and parses a .env file.
 * @param path - Path to the .env file
 * @returns An in-memory representation of the .env file.
 */
export async function readAndParseDotEnv(path: string): Promise<DotEnvFile> {
  debug(outputContent`Reading the .env file at ${token.path(path)}`)
  if (!(await exists(path))) {
    throw DotEnvNotFoundError(path)
  }
  const content = await readFile(path)
  return {
    path,
    variables: parse(content),
  }
}

/**
 * Writes a .env file to disk.
 * @param file - .env file to be written.
 */
export async function writeDotEnv(file: DotEnvFile) {
  await writeFile(file.path, stringify(file.variables))
}

/**
 * Given an .env file content, generates a new one with new values
 * without removing already existing lines.
 * @param envFileContent - .env file contents.
 * @param updatedValues - object containing new env variables values.
 */
export function patchEnvFile(
  envFileContent: string | null,
  updatedValues: {[key: string]: string | undefined},
): string {
  const outputLines: string[] = []
  const lines = envFileContent === null ? [] : envFileContent.split('\n')

  const alreadyPresentKeys: string[] = []

  const toLine = (key: string, value?: string) => `${key}=${value}`

  for (const line of lines) {
    const match = line.match(/^([^=:#]+?)[=:](.*)/)
    let lineToWrite = line

    if (match) {
      const key = match[1]!.trim()
      const newValue = updatedValues[key]
      if (newValue) {
        alreadyPresentKeys.push(key)
        lineToWrite = toLine(key, newValue)
      }
    }

    outputLines.push(lineToWrite)
  }

  for (const [patchKey, updatedValue] of Object.entries(updatedValues)) {
    if (!alreadyPresentKeys.includes(patchKey)) {
      outputLines.push(toLine(patchKey, updatedValue))
    }
  }

  return outputLines.join('\n')
}
