import {themeExtensionFiles} from '../../../utilities/extensions/theme.js'
import {copyFile} from '@shopify/cli-kit/node/fs'
import {relativePath, joinPath} from '@shopify/cli-kit/node/path'
import type {BuildStep, BuildContext} from '../build-steps.js'

/**
 * Executes a bundle_theme build step.
 *
 * Copies theme extension files to the output directory, preserving relative paths.
 * Respects the extension's .shopifyignore file and the standard ignore patterns.
 */
export async function executeBundleThemeStep(_step: BuildStep, context: BuildContext): Promise<{filesCopied: number}> {
  const {extension, options} = context
  options.stdout.write(`Bundling theme extension ${extension.localIdentifier}...`)
  const files = await themeExtensionFiles(extension)

  await Promise.all(
    files.map(async (filepath) => {
      const relativePathName = relativePath(extension.directory, filepath)
      const outputFile = joinPath(extension.outputPath, relativePathName)
      if (filepath === outputFile) return
      await copyFile(filepath, outputFile)
    }),
  )

  return {filesCopied: files.length}
}
