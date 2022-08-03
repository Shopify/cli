import {Abort} from '../error.js'
import {exists, read as readFile, write as writeFile} from '../file.js'
import {debug, content as outputContent, token} from '../output.js'
import {parse, stringify} from 'envfile'

/**
 * Error that's thrown when the .env is not found.
 * @param path {string} Path to the .env file.
 * @returns {Abort} An abort error.
 */
export const DotEnvNotFoundError = (path: string) => {
  return new Abort(`The environment file at ${path} does not exist.`)
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
 * @param path {string} Path to the .env file
 * @returns {Promise<DotEnvFile>} An in-memory representation of the .env file.
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
 * @param file {DotEnvFile} .env file to be written.
 */
export async function writeDotEnv(file: DotEnvFile) {
  await writeFile(file.path, stringify(file.variables))
}
