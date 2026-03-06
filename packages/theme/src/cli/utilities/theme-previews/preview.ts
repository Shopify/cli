import {buildBaseStorefrontUrl, buildHeaders} from '../theme-environment/storefront-renderer.js'
import {DevServerSession} from '../theme-environment/types.js'
import {recordTiming} from '@shopify/cli-kit/node/analytics'
import {AbortError} from '@shopify/cli-kit/node/error'
import {shopifyFetch, Response} from '@shopify/cli-kit/node/http'

interface CreateThemePreviewOptions {
  session: DevServerSession
  storefrontToken: string
  overridesContent: string
  themeId: string
}

interface UpdateThemePreviewOptions extends CreateThemePreviewOptions {
  previewIdentifier: string
}

interface ThemePreviewResult {
  url: string
  preview_identifier: string
}

interface PreviewResponse {
  url?: string
  preview_identifier?: string
  error?: string
}

/**
 * Creates a theme preview with overrides.
 *
 * @param options - The options for creating a theme preview.
 * @returns The preview URL and identifier for the applied overrides.
 */
export async function createThemePreview({
  session,
  overridesContent,
  themeId,
}: CreateThemePreviewOptions): Promise<ThemePreviewResult> {
  recordTiming('theme-preview:create')
  const baseUrl = buildBaseStorefrontUrl(session)
  const url = `${baseUrl}/theme_preview.json?preview_theme_id=${themeId}`

  const headers = await buildHeaders(session, {headers: {'Content-Type': 'application/json'}})
  const response = await shopifyFetch(url, {
    method: 'POST',
    body: overridesContent,
    headers,
  })

  if (!response.ok) {
    throw new AbortError(`Theme preview request failed with status ${response.status}: ${response.statusText}`)
  }

  const result = await parsePreviewResponse(response)
  recordTiming('theme-preview:create')
  return result
}

/**
 * Overwrites a theme preview session with new overrides.
 *
 * @param options - The options for updating a theme preview.
 * @returns The preview URL and identifier for the applied overrides.
 */
export async function updateThemePreview({
  session,
  overridesContent,
  themeId,
  previewIdentifier,
}: UpdateThemePreviewOptions): Promise<ThemePreviewResult> {
  recordTiming('theme-preview:update')
  const baseUrl = buildBaseStorefrontUrl(session)
  const url = `${baseUrl}/theme_preview.json?preview_theme_id=${themeId}&preview_identifier=${encodeURIComponent(previewIdentifier)}`

  const headers = await buildHeaders(session, {headers: {'Content-Type': 'application/json'}})
  const response = await shopifyFetch(url, {
    method: 'POST',
    body: overridesContent,
    headers,
  })

  if (!response.ok) {
    throw new AbortError(`Theme preview request failed with status ${response.status}: ${response.statusText}`)
  }

  const result = await parsePreviewResponse(response)
  recordTiming('theme-preview:update')
  return result
}

async function parsePreviewResponse(response: Response): Promise<ThemePreviewResult> {
  const body = (await response.json()) as PreviewResponse

  if (body.error) {
    throw new AbortError(`Theme preview failed: ${body.error}`)
  }

  if (!body.url || !body.preview_identifier) {
    throw new AbortError('Theme preview returned an unexpected response')
  }

  return {url: body.url, preview_identifier: body.preview_identifier}
}
