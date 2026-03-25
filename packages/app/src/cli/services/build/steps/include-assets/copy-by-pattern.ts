import {joinPath, dirname, relativePath} from '@shopify/cli-kit/node/path'
import {glob, copyFile, mkdir} from '@shopify/cli-kit/node/fs'

/**
 * Pattern strategy: glob-based file selection.
 */
export async function copyByPattern(
  config: {
    sourceDir: string
    outputDir: string
    patterns: string[]
    ignore: string[]
  },
  options: {stdout: NodeJS.WritableStream},
): Promise<number> {
  const {sourceDir, outputDir, patterns, ignore} = config
  const files = await glob(patterns, {
    absolute: true,
    cwd: sourceDir,
    ignore,
  })

  if (files.length === 0) {
    return 0
  }

  await mkdir(outputDir)

  const filesToCopy = files

  const copyResults = await Promise.all(
    filesToCopy.map(async (filepath): Promise<number> => {
      const relPath = relativePath(sourceDir, filepath)
      const destPath = joinPath(outputDir, relPath)

      if (relativePath(outputDir, destPath).startsWith('..')) {
        options.stdout.write(`Warning: skipping '${filepath}' - resolved destination is outside the output directory\n`)
        return 0
      }

      if (filepath === destPath) return 0

      await mkdir(dirname(destPath))
      await copyFile(filepath, destPath)
      return 1
    }),
  )

  const copiedCount = copyResults.reduce((sum, count) => sum + count, 0)
  options.stdout.write(`Included ${copiedCount} file(s)\n`)
  return copiedCount
}
