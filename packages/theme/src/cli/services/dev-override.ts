import {openURLSafely} from './dev.js'
import {fetchDevServerSession} from '../utilities/theme-environment/dev-server-session.js'
import {createThemePreview, updateThemePreview} from '../utilities/theme-previews/preview.js'
import {startMockShopPreviewSession} from '../utilities/theme-previews/mock-shop.js'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'
import {readFile, fileExistsSync} from '@shopify/cli-kit/node/fs'

interface ThemeOverrides {
  [key: string]: unknown
}

interface DevWithOverrideFileOptions {
  adminSession?: AdminSession
  overrideJson: string
  themeId?: string
  previewIdentifier?: string
  open: boolean
  password?: string
  json?: boolean
  mockShop?: boolean
  mockShopStorefrontUrl?: string
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

  const overridesContent = JSON.stringify(overrides)

  if (options.mockShop) {
    if (options.previewIdentifier) {
      throw new AbortError('The --preview-id flag is not supported with --mock-shop.')
    }

    if (options.json) {
      throw new AbortError('The --json flag is not supported with --mock-shop.')
    }

    const preview = await startMockShopPreviewSession(overridesContent, {
      storefrontUrl: options.mockShopStorefrontUrl,
    })

    renderSuccess({
      body: [
        {
          list: {
            title: 'Mock.shop preview is ready',
            items: [
              {link: {url: preview.launcherUrl}},
              `Target: ${preview.targetUrl}`,
              'This prototype opens an initial preview only.',
            ],
          },
        },
      ],
    })

    if (options.open) {
      openURLSafely(preview.launcherUrl, 'mock.shop preview')
    }

    await preview.completion
    return
  }

  if (!options.themeId) {
    throw new AbortError('A theme ID is required unless --mock-shop is used.')
  }

  if (!options.adminSession) {
    throw new AbortError('An admin session is required unless --mock-shop is used.')
  }

  const session = await fetchDevServerSession(options.themeId, options.adminSession, options.password)

  const preview = options.previewIdentifier
    ? await updateThemePreview({
        session,
        overridesContent,
        themeId: options.themeId,
        previewIdentifier: options.previewIdentifier,
      })
    : await createThemePreview({
        session,
        overridesContent,
        themeId: options.themeId,
      })

  if (options.json) {
    outputInfo(JSON.stringify({url: preview.url, preview_identifier: preview.preview_identifier}))
  } else {
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
  }

  if (options.open) {
    openURLSafely(preview.url, 'theme preview')
  }
}
