import {outputDebug, outputContent, outputToken} from '../../public/node/output.js'
import archiver from 'archiver'
import {createWriteStream} from 'fs'

interface ZipOptions {
  /**
   * The absolute path to the directory to be zipped.
   */
  inputDirectory: string

  /**
   * The absolute path to the output zip file.
   */
  outputZipPath: string

  /**
   * Pattern to match when adding files to zip, uses glob expressions.
   */
  matchFilePattern?: string
}

/**
 * It zips a directory and by default normalizes the paths to be forward-slash.
 * Even with forward-slash paths, zip files should still be able to be opened on
 * Windows.
 *
 * @param options - ZipOptions.
 */
export async function zip(options: ZipOptions): Promise<void> {
  const {inputDirectory, outputZipPath, matchFilePattern = '**/*'} = options
  const globOptions = {cwd: inputDirectory, absolute: true, dot: true, follow: false}
  outputDebug(outputContent`Zipping ${outputToken.path(inputDirectory)} into ${outputToken.path(outputZipPath)}`)

  return new Promise((resolve, reject) => {
    const archive = archiver('zip')

    const output = createWriteStream(outputZipPath)
    output.on('close', () => {
      resolve()
    })
    archive.on('error', (error) => {
      reject(error)
    })
    archive.pipe(output)

    archive.glob(matchFilePattern, globOptions)

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    archive.finalize()
  })
}
