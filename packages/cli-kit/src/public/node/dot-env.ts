import {AbortError} from './error.js'
import {fileExists, readFile, writeFile} from './fs.js'
import {outputDebug, outputContent, outputToken} from '../../public/node/output.js'
import {parse} from 'dotenv'

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
  outputDebug(outputContent`Reading the .env file at ${outputToken.path(path)}`)
  if (!(await fileExists(path))) {
    throw new AbortError(`The environment file at ${path} does not exist.`)
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
export async function writeDotEnv(file: DotEnvFile): Promise<void> {
  const fileContent = Object.entries(file.variables)
    .map(([key, value]) => createDotEnvFileLine(key, value))
    .join('\n')

  await writeFile(file.path, fileContent)
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
  const envFileLines = envFileContent === null ? [] : envFileContent.split('\n')

  const alreadyPresentKeys: string[] = []

  let multilineVariable:
    | {
        key: string
        value: string
        quote: string
      }
    | undefined

  for (const line of envFileLines) {
    if (multilineVariable) {
      if (line.endsWith(multilineVariable.quote)) {
        let lineToWrite = createDotEnvFileLine(
          multilineVariable.key,
          multilineVariable.value + line.slice(0, -1),
          multilineVariable.quote,
        )
        const newValue = updatedValues[multilineVariable.key]
        if (newValue) {
          alreadyPresentKeys.push(multilineVariable.key)
          lineToWrite = createDotEnvFileLine(multilineVariable.key, newValue)
        }
        outputLines.push(lineToWrite)
        multilineVariable = undefined
      } else {
        multilineVariable.value += `${line}\n`
      }
      continue
    }

    const match = line.match(/^([^=:#]+?)[=:](.*)/)
    let lineToWrite = line

    if (match) {
      const key = match[1]!.trim()
      const value = (match[2] || '')!.trim()

      if (/^["'`]/.test(value) && !value.endsWith(value[0]!)) {
        multilineVariable = {
          key,
          value: `${value.slice(1)}\n`,
          quote: value[0]!,
        }
        continue
      }

      const newValue = updatedValues[key]
      if (newValue) {
        alreadyPresentKeys.push(key)
        lineToWrite = createDotEnvFileLine(key, newValue)
      }
    }

    outputLines.push(lineToWrite)
  }

  if (multilineVariable) {
    throw new AbortError(`Multi-line environment variable '${multilineVariable.key}' is not properly enclosed.`)
  }

  for (const [patchKey, updatedValue] of Object.entries(updatedValues)) {
    if (!alreadyPresentKeys.includes(patchKey)) {
      outputLines.push(createDotEnvFileLine(patchKey, updatedValue))
    }
  }

  return outputLines.join('\n')
}

export function createDotEnvFileLine(key: string, value?: string, quote?: string): string {
  if (quote) {
    return `${key}=${quote}${value}${quote}`
  }
  if (value && value.includes('\n')) {
    const quoteCharacter = ['"', "'", '`'].find((char) => !value.includes(char))

    if (!quoteCharacter) {
      throw new AbortError(`The environment file patch has an env value that can't be surrounded by quotes: ${value}`)
    }

    return `${key}=${quoteCharacter}${value}${quoteCharacter}`
  }
  return `${key}=${value}`
}
