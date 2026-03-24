import {joinPath, dirname, basename} from '@shopify/cli-kit/node/path'
import {glob, copyFile, copyDirectoryContents, fileExists, mkdir, isDirectory} from '@shopify/cli-kit/node/fs'

/**
 * Handles a `{source}` or `{source, destination}` files entry.
 *
 * - No `destination`, `preserveStructure` false: copy directory contents into the output root.
 * - No `destination`, `preserveStructure` true: copy the directory under its own name in the output.
 * - With `destination`: copy to that exact path (`preserveStructure` is ignored).
 */
export async function copySourceEntry(
  config: {
    source: string
    destination: string | undefined
    baseDir: string
    outputDir: string
    preserveStructure: boolean
  },
  options: {stdout: NodeJS.WritableStream},
): Promise<number> {
  const {source, destination, baseDir, outputDir, preserveStructure} = config
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
    logMsg = `Copied ${source} to ${destination}\n`
  } else if (sourceIsDir && preserveStructure) {
    destPath = joinPath(outputDir, basename(sourcePath))
    logMsg = `Copied ${source} to ${basename(sourcePath)}\n`
  } else if (sourceIsDir) {
    destPath = outputDir
    logMsg = `Copied contents of ${source} to output root\n`
  } else {
    destPath = joinPath(outputDir, basename(sourcePath))
    logMsg = `Copied ${source} to ${basename(sourcePath)}\n`
  }

  if (sourceIsDir) {
    await copyDirectoryContents(sourcePath, destPath)
    const copied = await glob(['**/*'], {cwd: destPath, absolute: false})
    options.stdout.write(logMsg)
    return copied.length
  }

  await mkdir(dirname(destPath))
  await copyFile(sourcePath, destPath)
  options.stdout.write(logMsg)
  return 1
}
