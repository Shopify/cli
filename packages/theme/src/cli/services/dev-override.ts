import {openURLSafely} from './dev.js'
import {fetchDevServerSession} from '../utilities/theme-environment/dev-server-session.js'
import {createThemePreview, updateThemePreview} from '../utilities/theme-previews/preview.js'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
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
  open: boolean
  password?: string
}

/**
 * Reads a JSON overrides file and creates or updates a Storefront preview.
 * The resulting preview URL is displayed to the user.
 */
export async function devWithOverrideFile(options: DevWithOverrideFileOptions) {
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

  const preview = options.previewIdentifier
    ? await updateThemePreview({
        session,
        storefrontToken: session.storefrontToken,
        overridesContent,
        themeId: options.themeId,
        previewIdentifier: options.previewIdentifier,
      })
    : await createThemePreview({
        session,
        storefrontToken: session.storefrontToken,
        overridesContent,
        themeId: options.themeId,
      })

  renderSuccess({
    body: [
      {
        list: {
          title: options.previewIdentifier ? 'Preview updated' : 'Preview is ready',
          items: [{link: {url: preview.url}}, `Preview ID: ${preview.preview_identifier}`],
        },
      },
    ],
  })

  if (options.open) {
    openURLSafely(preview.url, 'theme preview')
  }
}
