import {debug, content, token} from '../output.js'
import {zip as crossZip} from 'cross-zip'

/**
 * It zips a directory.
 * @param inputDirectory {string} The absolute path to the directory to be zipped.
 * @param outputZipPath {string} The absolute path to the output zip file.
 */
export async function zip(inputDirectory: string, outputZipPath: string): Promise<void> {
  debug(content`Zipping ${token.path(inputDirectory)} into ${token.path(outputZipPath)}`)
  const cwd = process.cwd()
  process.chdir(inputDirectory)

  await new Promise<void>((resolve, reject) => {
    crossZip('./', outputZipPath, (error) => {
      process.chdir(cwd)
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}
