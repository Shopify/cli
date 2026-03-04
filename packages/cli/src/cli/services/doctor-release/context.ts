import {cwd} from '@shopify/cli-kit/node/path'
import type {DoctorContext} from '@shopify/cli-kit/node/doctor/types'

export interface ThemeDoctorContext extends DoctorContext {
  // Environment name from shopify.theme.toml (required)
  environment: string
  // Store URL (from environment or flags)
  store?: string
  // Password/token for Theme Access app
  password?: string
  // Theme name created during init
  themeName?: string
  // Theme path after init
  themePath?: string
  // Theme ID after push
  themeId?: string
}

export interface ThemeDoctorOptions {
  // Working directory (defaults to cwd)
  path?: string
  // Environment name from shopify.theme.toml (required)
  environment: string
  // Store URL (overrides environment)
  store?: string
  // Password/token (overrides environment)
  password?: string
}

/**
 * Detects the CLI command used to invoke the current process by finding the
 * command's first topic in argv and returning everything before it.
 *
 * Examples:
 * `npx shopify doctor-release theme` → `npx shopify`
 * `shopify doctor-release theme` → `shopify`
 * `pnpm shopify doctor-release theme` → `pnpm shopify`
 * `node packages/cli/bin/dev.js doctor-release theme` → `node packages/cli/bin/dev.js`
 */
export function detectCliCommand(commandHandle?: string, argv: string[] = process.argv): string {
  const defaultCommand = 'shopify'

  if (!commandHandle) return defaultCommand

  const firstTopic = commandHandle.split(':')[0]
  if (!firstTopic) return defaultCommand

  const index = argv.findIndex((arg) => arg === firstTopic)

  if (index <= 0) return defaultCommand

  return argv.slice(0, index).join(' ')
}

export function createDoctorContext(options: ThemeDoctorOptions, commandHandle?: string): ThemeDoctorContext {
  return {
    workingDirectory: options.path ?? cwd(),
    cliCommand: detectCliCommand(commandHandle),
    environment: options.environment,
    store: options.store,
    password: options.password,
    data: {},
  }
}
