import {debug, content, token} from '../output.js'
import {glob, relative as relativePath, normalize as normalizePath} from '../path.js'
import archiver from 'archiver'
import {createWriteStream} from 'node:fs'
/**
 * It zips a directory.
 * @param inputDirectory {string} The absolute path to the directory to be zipped.
 * @param outputZipPath {string} The absolute path to the output zip file.
 */
export async function zip(inputDirectory: string, outputZipPath: string): Promise<void> {
  debug(content`Zipping ${token.path(inputDirectory)} into ${token.path(outputZipPath)}`)
  const pathsToZip = await glob('**/*', {cwd: inputDirectory, absolute: true, dot: true, followSymbolicLinks: false})
  return new Promise((resolve, reject) => {
    const archive = archiver('zip')
    const output = createWriteStream(outputZipPath)

    output.on('close', function () {
      resolve()
    })
    archive.on('error', function (error) {
      reject(error)
    })
    archive.pipe(output)

    for (const filePath of pathsToZip) {
      const fileRelativePath = relativePath(inputDirectory, normalizePath(filePath))
      archive.file(filePath, {name: fileRelativePath})
    }

    archive.finalize()
  })
}
