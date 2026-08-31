import {AbortError} from '@shopify/cli-kit/node/error'
import {fileExists, readFile} from '@shopify/cli-kit/node/fs'
import {readStdinString} from '@shopify/cli-kit/node/system'

export interface LoadCsvInputDependencies {
  fileExists?: typeof fileExists
  readFile?: (path: string) => Promise<string>
  readStdin?: typeof readStdinString
}

const defaultDependencies = {
  fileExists,
  readFile,
  readStdin: readStdinString,
}

export async function loadCsvInput(
  input: string,
  dependencies: LoadCsvInputDependencies = defaultDependencies,
): Promise<string> {
  const inputDependencies = {...defaultDependencies, ...dependencies}
  if (input !== '-') {
    if (!(await inputDependencies.fileExists(input))) {
      throw new AbortError(`CSV file not found: ${input}`)
    }

    try {
      return await inputDependencies.readFile(input)
    } catch (error) {
      if (error instanceof AbortError) throw error

      const message = error instanceof Error ? error.message : String(error)
      throw new AbortError(`Couldn't read CSV file ${input}: ${message}`)
    }
  }

  const content = await inputDependencies.readStdin()
  if (content === undefined || content === '') {
    throw new AbortError('Provide --input <path> or pipe CSV data to stdin.')
  }
  return content
}
