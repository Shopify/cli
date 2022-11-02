import {exists as fileExists} from '../../file.js'
import {join as joinPath} from '../../path.js'
import {getRandomName} from '../common/string.js'

interface GenerateRandomDirectoryOptions {
  /** Suffix to include in the randomly generated directory name */
  suffix: string

  /** Absolute path to the directory where the random directory will be created. */
  directory: string
}

/**
 * It generates a random directory directory name for a sub-directory.
 * It ensures that the returned directory name doesn't exist.
 *
 * @returns It returns the name of the directory.
 */
export async function generateRandomNameForSubdirectory(options: GenerateRandomDirectoryOptions): Promise<string> {
  const generated = `${getRandomName()}-${options.suffix}`
  const randomDirectoryPath = joinPath(options.directory, generated)
  const isAppDirectoryTaken = await fileExists(randomDirectoryPath)

  if (isAppDirectoryTaken) {
    return generateRandomNameForSubdirectory({suffix: options.suffix, directory: options.directory})
  } else {
    return generated
  }
}
