import {themeInitJsonOutputSchema, projectThemeInitResult, type ThemeInitResult} from './types.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderWarning} from '@shopify/cli-kit/node/ui'

export function renderThemeInitResult(result: ThemeInitResult, format: 'text' | 'json'): void {
  // Text mode already reports completion through the cloning and AI instruction tasks.
  if (format === 'json') outputResult(themeInitJsonOutputSchema.encode(projectThemeInitResult(result)))
}

export function renderAIInstructionsWarning(copiedFiles: string[]): void {
  if (copiedFiles.length === 0) return

  const headline = 'Files created instead of symlinks.'
  const body = `Shopify CLI attempted to create symbolic links between AGENTS.md and ${copiedFiles.join(
    ', ',
  )}, but your system doesn't have Developer Mode enabled or symlinks are disabled. Separate files were created instead.`

  renderWarning({headline, body})
}
