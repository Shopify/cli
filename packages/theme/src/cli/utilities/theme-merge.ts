/* eslint-disable no-catch-all/no-catch-all */
import {readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {outputDebug, outputInfo} from '@shopify/cli-kit/node/output'
import {basename} from '@shopify/cli-kit/node/path'

export interface MergeResult {
  success: boolean
  conflictResolved: boolean
  strategy: string
}

/**
 * Environment-preserving merge strategy for Shopify theme files
 * This is called by Git as a custom merge driver
 */
export async function preserveEnvironmentMerge(
  // %O - common ancestor file
  base: string,
  // %A - current branch version (ours)
  current: string,
  // %B - incoming branch version (theirs)
  incoming: string,
  // %L - conflict marker size
  _markerSize = 7,
): Promise<MergeResult> {
  const fileName = basename(current)
  outputDebug(`Shopify theme merge: ${fileName}`)

  try {
    // For environment-specific files, we use "preserve current environment" strategy
    if (isEnvironmentSpecificFile(fileName)) {
      return await preserveCurrentEnvironment(current, incoming, fileName)
    }

    // For other files, attempt smart merge
    return await attemptSmartMerge(base, current, incoming, fileName)
  } catch (error) {
    // Expected: merge errors are handled gracefully with fallback strategy
    outputDebug(`Merge error for ${fileName}: ${error}`)
    return {
      success: true,
      conflictResolved: true,
      strategy: 'fallback-preserve-current',
    }
  }
}

/**
 * Preserve current environment's version of the file
 */
async function preserveCurrentEnvironment(_current: string, _incoming: string, fileName: string): Promise<MergeResult> {
  // Current file is already in place, no changes needed
  // This preserves the current environment's settings

  outputInfo(`🔒 Preserved ${fileName} for current environment`)

  return {
    success: true,
    conflictResolved: true,
    strategy: 'preserve-current-environment',
  }
}

/**
 * Attempt intelligent merge for JSON files
 */
async function attemptSmartMerge(
  _base: string,
  current: string,
  incoming: string,
  fileName: string,
): Promise<MergeResult> {
  if (!fileName.endsWith('.json')) {
    // For non-JSON files, preserve current
    return {
      success: true,
      conflictResolved: true,
      strategy: 'preserve-current-non-json',
    }
  }

  try {
    const currentContent = await readFile(current, {encoding: 'utf8'})
    const incomingContent = await readFile(incoming, {encoding: 'utf8'})

    const currentJson = JSON.parse(currentContent)
    const incomingJson = JSON.parse(incomingContent)

    // Simple merge: preserve current values, add new structure from incoming
    const merged = {...incomingJson, ...currentJson}

    await writeFile(current, JSON.stringify(merged, null, 2))

    outputInfo(`🔀 Smart merged ${fileName}`)

    return {
      success: true,
      conflictResolved: true,
      strategy: 'smart-json-merge',
    }
  } catch (error) {
    // Expected: JSON parsing can fail for invalid JSON, preserve current version
    outputDebug(`JSON merge failed for ${fileName}: ${error}`)
    return {
      success: true,
      conflictResolved: true,
      strategy: 'json-fallback-preserve-current',
    }
  }
}

/**
 * Determine if a file contains environment-specific settings
 */
function isEnvironmentSpecificFile(fileName: string): boolean {
  const environmentSpecificPatterns = [
    'settings_data.json',
    // Template and section JSON files
    /^.*\.json$/,
    'checkout.json',
    'customer.json',
    'sections.json',
  ]

  return environmentSpecificPatterns.some((pattern) => {
    if (typeof pattern === 'string') {
      return fileName === pattern || fileName.endsWith(pattern)
    } else {
      return pattern.test(fileName)
    }
  })
}
