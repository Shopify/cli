import {relativePath} from './path.js'
import {glob, removeFile} from './fs.js'
import {outputDebug} from '../../public/node/output.js'
import archiver from 'archiver'
import {joinPath} from '@shopify/cli-kit/node/path'
import {createWriteStream, readFileSync, writeFileSync} from 'fs'
import {tmpdir} from 'os'
import {randomUUID} from 'crypto'

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
   * Pattern(s) to match when adding files to zip, uses glob expressions.
   */
  matchFilePattern?: string | string[]
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
  outputDebug(`Zipping ${inputDirectory} into ${outputZipPath}`)
  const pathsToZip = await glob(matchFilePattern, {
    cwd: inputDirectory,
    absolute: true,
    dot: true,
    followSymbolicLinks: false,
  })

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

    for (const filePath of pathsToZip) {
      const fileRelativePath = relativePath(inputDirectory, filePath)
      archive.file(filePath, {name: fileRelativePath})
    }

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    archive.finalize()
  })
}

export interface BrotliOptions {
  /**
   * The directory to compress.
   */
  inputDirectory: string

  /**
   * The path where the compressed file will be saved.
   */
  outputPath: string

  /**
   * An optional glob pattern to match files.
   */
  matchFilePattern?: string | string[]

  /**
   * Brotli compression level (0-11, default: 11).
   */
  level?: number
}

/**
 * Options for decompressing a Brotli compressed tar archive.
 */
export interface DecompressionOptions {
  /**
   * Path to the compressed file.
   */
  inputFile: string

  /**
   * Directory where files should be extracted.
   */
  outputDirectory: string
}

/**
 * It compresses a directory with Brotli.
 * First creates a tar archive to preserve directory structure,
 * then compresses it with Brotli.
 *
 * @param options - BrotliOptions.
 */
export async function brotliCompress(options: BrotliOptions): Promise<void> {
  const tempTarPath = joinPath(tmpdir(), `${randomUUID()}.tar`)

  try {
    // Create tar archive using archiver
    await new Promise<void>((resolve, reject) => {
      const archive = archiver('tar')
      const output = createWriteStream(tempTarPath)

      output.on('close', () => resolve())
      archive.on('error', (error) => reject(error))
      archive.pipe(output)

      glob(options.matchFilePattern ?? '**/*', {
        cwd: options.inputDirectory,
        absolute: true,
        dot: true,
        followSymbolicLinks: false,
      })
        .then((pathsToZip) => {
          for (const filePath of pathsToZip) {
            const fileRelativePath = relativePath(options.inputDirectory, filePath)
            archive.file(filePath, {name: fileRelativePath})
          }
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          archive.finalize()
        })
        .catch((error) => reject(error))
    })

    const tarContent = readFileSync(tempTarPath)
    const brotli = await import('brotli')
    const compressed = brotli.default.compress(tarContent, {
      quality: 7,
      mode: 0,
    })

    if (!compressed) {
      throw new Error('Brotli compression failed')
    }

    writeFileSync(options.outputPath, compressed)
  } finally {
    try {
      await removeFile(tempTarPath)
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      outputDebug(`Failed to clean up temporary file: ${tempTarPath}`)
    }
  }
}
