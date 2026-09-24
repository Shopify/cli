import {type ThemePreviewResult} from './dev-override/types.js'
import {fetchDevServerSession} from '../utilities/theme-environment/dev-server-session.js'
import {createThemePreview, updateThemePreview} from '../utilities/theme-previews/preview.js'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'
import {readFile, fileExistsSync} from '@shopify/cli-kit/node/fs'

interface ThemeOverrides {
  [key: string]: unknown
}

interface DevWithOverrideFileOptions {
  adminSession: AdminSession
  overrideJson: string
  themeId: string
  previewIdentifier?: string
  password?: string
}

/**
 * Reads a JSON overrides file and creates or updates a Storefront preview.
 * Returns the preview URL and identifier.
 */
export async function devWithOverrideFile(options: DevWithOverrideFileOptions): Promise<ThemePreviewResult> {
  if (!fileExistsSync(options.overrideJson)) {
    throw new AbortError(`Override file not found: ${options.overrideJson}`)
  }

  const fileContent = await readFile(options.overrideJson)
  let overrides: ThemeOverrides
  try {
    overrides = JSON.parse(fileContent) as ThemeOverrides
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new AbortError(`Failed to parse override file: ${options.overrideJson}`, reason)
  }

  const session = await fetchDevServerSession(options.themeId, options.adminSession, options.password)
  const overridesContent = JSON.stringify(overrides)

  return options.previewIdentifier
    ? updateThemePreview({
        session,
        overridesContent,
        themeId: options.themeId,
        previewIdentifier: options.previewIdentifier,
      })
    : createThemePreview({
        session,
        overridesContent,
        themeId: options.themeId,
      })
}
