import {Abort} from './error'
import {exists, read as readFile, write as writeFile} from './file'
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
interface DotEnvFile {
  /**
   * Path to the .env file.
   */
  path: string
  /**
   * Content of the .env file.
   */
  content: {[name: string]: string}
}

export async function read(path: string): Promise<DotEnvFile> {
  if (!(await exists(path))) {
    throw DotEnvNotFoundError(path)
  }
  const content = await readFile(path)
  return {
    path,
    content: parse(content),
  }
}

/**
 * Writes a .env file to disk.
 * @param file {DotEnvFile} .env file to be written.
 */
export async function write(file: DotEnvFile) {
  await writeFile(file.path, stringify(file.content))
}
