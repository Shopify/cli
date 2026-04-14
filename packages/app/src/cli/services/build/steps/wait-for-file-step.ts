import {getNestedValue} from './include-assets/copy-config-key-entry.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {fileExists} from '@shopify/cli-kit/node/fs'
import {outputDebug} from '@shopify/cli-kit/node/output'
import type {BuildContext} from '../client-steps.js'

export interface WaitForFileConfig {
  /**
   * Config key path to resolve the directory (e.g., 'admin.static_root').
   * The directory path is resolved relative to the extension directory.
   */
  configKey: string

  /**
   * The filename to wait for within the resolved directory.
   */
  filename: string

  /**
   * Maximum time to wait in milliseconds.
   * Default: 60000 (60 seconds)
   */
  timeoutMs?: number

  /**
   * Interval between checks in milliseconds.
   * Default: 500 (0.5 seconds)
   */
  intervalMs?: number
}

export interface WaitForFileStep {
  readonly id: string
  readonly name: string
  readonly type: 'wait_for_file'
  readonly config: WaitForFileConfig
  readonly continueOnError?: boolean
}

/**
 * Waits for a specific file to exist before proceeding.
 *
 * This step is useful when the extension depends on files that are built
 * asynchronously by another process (e.g., a web process running a build).
 *
 * If the config key doesn't resolve to a value, the step succeeds immediately
 * (the file is not required).
 *
 * @throws Error if the file doesn't exist within the timeout period
 */
export async function executeWaitForFileStep(
  step: WaitForFileStep,
  context: BuildContext,
): Promise<{waited: boolean; filePath?: string}> {
  const {configKey, filename, timeoutMs = 60000, intervalMs = 500} = step.config
  const {stdout} = context.options

  const configValue = getNestedValue(context.extension.configuration, configKey)

  if (typeof configValue !== 'string') {
    outputDebug(`No value for configKey '${configKey}', skipping wait\n`, stdout)
    return {waited: false}
  }

  const filePath = joinPath(context.extension.directory, configValue, filename)

  // Check if file already exists
  if (await fileExists(filePath)) {
    outputDebug(`File '${filename}' already exists in '${configValue}'\n`, stdout)
    return {waited: false, filePath}
  }

  stdout.write(`Waiting for '${filename}' in '${configValue}'...\n`)

  const startTime = Date.now()
  let elapsed = 0

  while (elapsed < timeoutMs) {
    // eslint-disable-next-line no-await-in-loop
    await sleep(intervalMs)
    elapsed = Date.now() - startTime

    // eslint-disable-next-line no-await-in-loop
    if (await fileExists(filePath)) {
      const waitedSeconds = (elapsed / 1000).toFixed(1)
      stdout.write(`Found '${filename}' in '${configValue}' (waited ${waitedSeconds}s)\n`)
      return {waited: true, filePath}
    }
  }

  const timeoutSeconds = (timeoutMs / 1000).toFixed(0)
  throw new Error(
    `Timed out waiting for '${filename}' in '${configValue}' after ${timeoutSeconds}s. ` +
      `Make sure your build process creates this file (e.g., via a predev hook).`,
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
