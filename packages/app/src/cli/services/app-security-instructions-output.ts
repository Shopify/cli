import {appSecurityInstructions} from './app-security-instructions.js'
import {writeFile} from '@shopify/cli-kit/node/fs'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import clipboard from 'clipboardy'
import type {AppSecurityCommands} from './app-security-commands.js'
import type {AppSecurityScope} from './app-security-engine/index.js'

interface AppSecurityInstructionsDeliveryOptions {
  appDirectory: string
  resultsKey: string
  copy: boolean
  writePath?: string
  /** The caller puts the instructions in its JSON result, so they aren't printed and no banner is shown. */
  json: boolean
  commands: AppSecurityCommands
  /** Present when `check` has just run in this process. */
  scanScope?: AppSecurityScope
}

export interface AppSecurityInstructionsDelivery {
  content: string
  copiedToClipboard: boolean
  writePath?: string
}

interface AppSecurityInstructionsOutputDependencies {
  copyToClipboard(content: string): Promise<void>
  writeToFile(path: string, content: string): Promise<void>
  output(content: string): void
  outputConfirmation(content: string): void
}

const defaultDependencies: AppSecurityInstructionsOutputDependencies = {
  copyToClipboard: (content) => clipboard.write(content),
  writeToFile: writeFile,
  output: outputResult,
  outputConfirmation: (content) => {
    renderSuccess({headline: content})
  },
}

/**
 * Delivers the instructions to their output channel: the clipboard, a file, or stdout. In JSON mode stdout is
 * reserved for the caller's result, so the instructions aren't printed and the confirmation banners aren't shown;
 * the returned delivery says where they went.
 */
export async function deliverAppSecurityInstructions(
  options: AppSecurityInstructionsDeliveryOptions,
  dependencies: AppSecurityInstructionsOutputDependencies = defaultDependencies,
): Promise<AppSecurityInstructionsDelivery> {
  const content = appSecurityInstructions({
    appDirectory: options.appDirectory,
    resultsKey: options.resultsKey,
    commands: options.commands,
    scanScope: options.scanScope,
  })

  if (options.copy) {
    await dependencies.copyToClipboard(content)
    if (!options.json) dependencies.outputConfirmation('Copied app security check instructions to the clipboard')
  } else if (options.writePath) {
    await dependencies.writeToFile(options.writePath, `${content}\n`)
    if (!options.json) dependencies.outputConfirmation(`Wrote app security check instructions to ${options.writePath}`)
  } else if (!options.json) {
    dependencies.output(content)
  }

  return {content, copiedToClipboard: options.copy, writePath: options.writePath}
}
