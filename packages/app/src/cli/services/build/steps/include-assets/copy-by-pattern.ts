import {assertPathWithinAppDir} from './assert-path-within-app.js'
import {joinPath, dirname, relativePath} from '@shopify/cli-kit/node/path'
import {glob, copyFile, mkdir, fileExists} from '@shopify/cli-kit/node/fs'

/**
 * Pattern strategy: glob-based file selection.
 */
export async function copyByPattern(
  config: {
    sourceDir: string
    outputDir: string
    patterns: string[]
    ignore: string[]
    appDirectory: string
    sourceDirConfigValue: string
  },
  options: {stdout: NodeJS.WritableStream},
): Promise<{filesCopied: number; outputPaths: string[]}> {
  const {sourceDir, outputDir, patterns, ignore, appDirectory, sourceDirConfigValue} = config

  // Validate the boundary up front, before touching the filesystem. Realpath
  // would throw on a missing sourceDir, so preserve the existing "missing dir
  // = no files" behavior by short-circuiting first.
  if (!(await fileExists(sourceDir))) {
    return {filesCopied: 0, outputPaths: []}
  }
  await assertPathWithinAppDir(sourceDir, appDirectory, sourceDirConfigValue)

  const files = await glob(patterns, {
    absolute: true,
    cwd: sourceDir,
    ignore,
  })

  if (files.length === 0) {
    return {filesCopied: 0, outputPaths: []}
  }

  await mkdir(outputDir)

  const filesToCopy = files

  const copyResults = await Promise.all(
    filesToCopy.map(async (filepath): Promise<{count: number; path: string | null}> => {
      const relPath = relativePath(sourceDir, filepath)
      const destPath = joinPath(outputDir, relPath)

      if (relativePath(outputDir, destPath).startsWith('..')) {
        options.stdout.write(`Warning: skipping '${filepath}' - resolved destination is outside the output directory\n`)
        return {count: 0, path: null}
      }

      if (filepath === destPath) return {count: 0, path: null}

      await mkdir(dirname(destPath))
      await copyFile(filepath, destPath)
      return {count: 1, path: relPath}
    }),
  )

  const filesCopied = copyResults.reduce((sum, result) => sum + result.count, 0)
  const outputPaths = copyResults.flatMap((result) => (result.path === null ? [] : [result.path]))
  options.stdout.write(`Included ${filesCopied} file(s)\n`)
  return {filesCopied, outputPaths}
}
