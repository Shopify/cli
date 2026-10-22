import {effectiveClientId, type AppSecuritySelection} from './app-security-selection.js'
import {isAbsolutePath} from '@shopify/cli-kit/node/path'
import {zod} from '@shopify/cli-kit/node/schema'
// eslint-disable-next-line no-restricted-imports -- JSON file paths use native platform separators.
import {resolve} from 'node:path'
import type {AppSecurityInstructionsDelivery} from './app-security-instructions.js'

/**
 * The parts of the app security commands' JSON output that several commands share, and the codecs that map the
 * commands' data to them. This is the public contract: the stored results files have their own format, in
 * app-security-engine/results/schema.ts, and never appear in it.
 */

/**
 * An absolute path with the platform's native separators. A function, so each field gets its own instance: the JSON
 * Schema would render a shared instance as a `$ref` into the first field that uses it.
 */
export const createAbsolutePathSchema = () =>
  zod.string().refine(isAbsolutePath, 'Expected an absolute native filesystem path')

/** The app the command worked on. */
export const appSecurityAppSchema = zod
  .object({
    directory: createAbsolutePathSchema().describe('The absolute app directory.'),
    configurationPath: createAbsolutePathSchema()
      .nullable()
      .describe('The absolute path of the selected app configuration file, or null with --without-app-config.'),
    clientId: zod
      .string()
      .min(1)
      .nullable()
      .describe(
        "The --client-id value when passed, otherwise the app configuration's client_id. Null when the app configuration isn't linked.",
      ),
  })
  .strict()

type AppSecurityApp = zod.infer<typeof appSecurityAppSchema>

/** The coding-agent instructions, which a JSON result includes instead of printing them. */
export const appSecurityInstructionsSchema = zod
  .object({
    content: zod.string().min(1).describe('The instructions in Markdown, as printed without --json.'),
    copied: zod.boolean().describe('Whether the instructions were also copied to the clipboard.'),
  })
  .strict()

type AppSecurityInstructions = zod.infer<typeof appSecurityInstructionsSchema>

/** CLI Kit joins paths with forward slashes, even on Windows. JSON output shows them absolute, with native separators. */
export function projectAppSecurityPath(path: string): string {
  return resolve(path)
}

export function projectAppSecurityApp(selection: AppSecuritySelection): AppSecurityApp {
  return {
    directory: projectAppSecurityPath(selection.appDirectory),
    configurationPath: selection.kind === 'config' ? projectAppSecurityPath(selection.appConfigFilePath) : null,
    clientId: effectiveClientId(selection) ?? null,
  }
}

/** Projects delivered instructions: `delivery.copy` means that they're on the clipboard. */
export function projectAppSecurityInstructions(
  instructions: string,
  delivery: AppSecurityInstructionsDelivery,
): AppSecurityInstructions {
  return {content: instructions, copied: delivery.copy}
}
