import {cwd} from '@shopify/cli-kit/shared/node/path'
import type {DoctorContext} from '@shopify/cli-kit/shared/node/doctor/types'

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

export function createDoctorContext(options: ThemeDoctorOptions): ThemeDoctorContext {
  return {
    workingDirectory: options.path ?? cwd(),
    environment: options.environment,
    store: options.store,
    password: options.password,
    data: {},
  }
}
