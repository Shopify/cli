import {fileExists} from '../../file.js'
import {join as joinPath} from '../../path.js'
import {getRandomName} from '../common/string.js'
import type {RandomNameFamily} from '../common/string.js'

interface GenerateRandomDirectoryOptions {
  /** Suffix to include in the randomly generated directory name */
  suffix: string

  /** Absolute path to the directory where the random directory will be created. */
  directory: string

  /** Type of word to use for random name */
  family?: RandomNameFamily
}

/**
 * It generates a random directory directory name for a sub-directory.
 * It ensures that the returned directory name doesn't exist.
 *
 * @returns It returns the name of the directory.
 */
export async function generateRandomNameForSubdirectory(options: GenerateRandomDirectoryOptions): Promise<string> {
  const generated = `${getRandomName(options.family ?? 'business')}-${options.suffix}`
  const randomDirectoryPath = joinPath(options.directory, generated)
  const isAppDirectoryTaken = await fileExists(randomDirectoryPath)

  if (isAppDirectoryTaken) {
    return generateRandomNameForSubdirectory(options)
  } else {
    return generated
  }
}
