import {joinPath, dirname, relativePath, basename} from '@shopify/cli-kit/node/path'
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
    preserveStructure: boolean
  },
  options: {stdout: NodeJS.WritableStream},
): Promise<number> {
  const {sourceDir, outputDir, patterns, ignore, preserveStructure} = config
  const files = await glob(patterns, {
    absolute: true,
    cwd: sourceDir,
    ignore,
  })

  if (files.length === 0) {
    options.stdout.write(`Warning: No files matched patterns in ${sourceDir}\n`)
    return 0
  }

  await mkdir(outputDir)

  const duplicates = new Set<string>()
  if (!preserveStructure) {
    const basenames = files.map((fp) => basename(fp))
    const seen = new Set<string>()
    for (const name of basenames) {
      if (seen.has(name)) {
        duplicates.add(name)
      } else {
        seen.add(name)
      }
    }
    if (duplicates.size > 0) {
      const colliding = files.filter((fp) => duplicates.has(basename(fp)))
      options.stdout.write(
        `Warning: filename collision detected when flattening — the following files share a basename and will overwrite each other: ${colliding.join(', ')}\n`,
      )
    }
  }

  // When flattening and collisions exist, deduplicate so last-in-array deterministically wins
  const filesToCopy =
    !preserveStructure && duplicates.size > 0
      ? files.filter((fp, idx) => {
          const name = basename(fp)
          if (!duplicates.has(name)) return true
          const lastIdx = files.reduce((last, file, ii) => (basename(file) === name ? ii : last), -1)
          return lastIdx === idx
        })
      : files

  const copyResults = await Promise.all(
    filesToCopy.map(async (filepath): Promise<number> => {
      const relPath = preserveStructure ? relativePath(sourceDir, filepath) : basename(filepath)
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
  options.stdout.write(`Copied ${copiedCount} file(s) from ${sourceDir} to ${outputDir}\n`)
  return copiedCount
}
