import {writeFile} from '@shopify/cli-kit/node/fs'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import clipboard from 'clipboardy'
import type {AppSecurityInstructionsJson} from './security-instructions-json.js'

interface AppSecurityInstructionsDeliveryDependencies {
  copyToClipboard(content: string): Promise<void>
  writeToFile(path: string, content: string): Promise<void>
}

interface AppSecurityInstructionsRenderDependencies {
  output(content: string): void
  outputConfirmation(content: string): void
}

const defaultDeliveryDependencies: AppSecurityInstructionsDeliveryDependencies = {
  copyToClipboard: (content) => clipboard.write(content),
  writeToFile: writeFile,
}

const defaultRenderDependencies: AppSecurityInstructionsRenderDependencies = {
  output: outputResult,
  outputConfirmation: (content) => {
    renderSuccess({headline: content})
  },
}

/**
 * Copies the instructions to the clipboard or writes them to `writePath`, and otherwise does nothing. It shows
 * nothing in the terminal, so it runs the same way in JSON mode.
 */
export async function deliverAppSecurityInstructions(
  content: string,
  delivery: {copy: boolean; writePath?: string},
  dependencies: AppSecurityInstructionsDeliveryDependencies = defaultDeliveryDependencies,
): Promise<void> {
  if (delivery.copy) {
    await dependencies.copyToClipboard(content)
  } else if (delivery.writePath) {
    await dependencies.writeToFile(delivery.writePath, `${content}\n`)
  }
}

/** Confirms delivered instructions in the terminal, or prints them when they were neither copied nor written. */
export function renderAppSecurityInstructions(
  instructions: AppSecurityInstructionsJson,
  dependencies: AppSecurityInstructionsRenderDependencies = defaultRenderDependencies,
): void {
  if (instructions.copiedToClipboard) {
    dependencies.outputConfirmation('Copied app security check instructions to the clipboard')
  } else if (instructions.path) {
    dependencies.outputConfirmation(`Wrote app security check instructions to ${instructions.path}`)
  } else {
    dependencies.output(instructions.content)
  }
}
