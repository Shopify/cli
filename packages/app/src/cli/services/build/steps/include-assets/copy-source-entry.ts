import {joinPath, dirname, basename, relativePath} from '@shopify/cli-kit/node/path'
import {glob, copyFile, copyDirectoryContents, fileExists, mkdir, isDirectory} from '@shopify/cli-kit/node/fs'

/**
 * Handles a `{source}` or `{source, destination}` files entry.
 *
 * - No `destination`: copy the directory under its own name in the output.
 * - With `destination`: copy to that exact path.
 */
export async function copySourceEntry(
  config: {
    source: string
    destination: string | undefined
    baseDir: string
    outputDir: string
  },
  options: {stdout: NodeJS.WritableStream},
): Promise<{filesCopied: number; outputPaths: string[]}> {
  const {source, destination, baseDir, outputDir} = config
  const sourcePath = joinPath(baseDir, source)
  if (!(await fileExists(sourcePath))) {
    throw new Error(`Source does not exist: ${sourcePath}`)
  }

  const sourceIsDir = await isDirectory(sourcePath)

  // Resolve destination path and log message up front, then dispatch on file vs directory.
  let destPath: string
  let logMsg: string
  if (destination !== undefined) {
    destPath = joinPath(outputDir, destination)
    logMsg = `Included ${source}\n`
  } else {
    destPath = joinPath(outputDir, basename(sourcePath))
    logMsg = `Included ${source}\n`
  }

  if (sourceIsDir) {
    await copyDirectoryContents(sourcePath, destPath)
    const copied = await glob(['**/*'], {cwd: destPath, absolute: false})
    options.stdout.write(logMsg)
    const destRelToOutput = relativePath(outputDir, destPath)
    const outputPaths = destRelToOutput ? copied.map((file) => joinPath(destRelToOutput, file)) : copied
    return {filesCopied: copied.length, outputPaths}
  }

  await mkdir(dirname(destPath))
  await copyFile(sourcePath, destPath)
  options.stdout.write(logMsg)
  return {filesCopied: 1, outputPaths: [relativePath(outputDir, destPath)]}
}
