import {AbortError} from '@shopify/cli-kit/node/error'
import {tempDirectory, writeFile} from '@shopify/cli-kit/node/fs'

import {join} from 'path'
import {pathToFileURL} from 'url'

const DEFAULT_MOCK_SHOP_STOREFRONT_URL = 'https://demostore.mock.shop'
const MAX_PAYLOAD_BYTES = 2 * 1024 * 1024

export interface MockShopPreviewSession {
  launcherUrl: string
  targetUrl: string
  completion: Promise<void>
}

interface MockShopPreviewSessionOptions {
  storefrontUrl?: string
}

/**
 * Writes a one-shot launcher page that posts theme overrides directly to the
 * target storefront. This avoids a localhost proxy while still letting the
 * browser perform a top-level POST navigation.
 */
export async function startMockShopPreviewSession(
  overridesContent: string,
  options: MockShopPreviewSessionOptions = {},
): Promise<MockShopPreviewSession> {
  const payloadBytes = Buffer.byteLength(overridesContent, 'utf8')
  if (payloadBytes > MAX_PAYLOAD_BYTES) {
    throw new AbortError(`Override payload exceeds the 2 MB mock.shop preview limit (${payloadBytes} bytes).`)
  }

  const targetUrl = getMockShopThemePreviewUrl(options.storefrontUrl)
  const launcherDirectory = tempDirectory()
  const launcherPath = join(launcherDirectory, 'mock-shop-preview.html')

  await writeFile(launcherPath, createMockShopLauncherPage({overridesContent, targetUrl}))

  return {
    launcherUrl: pathToFileURL(launcherPath).href,
    targetUrl,
    completion: Promise.resolve(),
  }
}

export function createMockShopLauncherPage({
  overridesContent,
  targetUrl,
}: {
  overridesContent: string
  targetUrl: string
}) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Opening mock.shop preview…</title>
  </head>
  <body>
    <form
      id="mock-shop-preview-form"
      method="POST"
      action="${escapeHtml(targetUrl)}"
      enctype="multipart/form-data"
      accept-charset="utf-8"
    >
      <textarea name="overrides" style="display:none">${escapeHtml(overridesContent)}</textarea>
      <noscript>
        <p>JavaScript is required to auto-open the preview.</p>
        <button type="submit">Open preview</button>
      </noscript>
    </form>
    <script>
      document.getElementById('mock-shop-preview-form')?.submit()
    </script>
  </body>
</html>`
}

function getMockShopThemePreviewUrl(storefrontUrl = DEFAULT_MOCK_SHOP_STOREFRONT_URL) {
  return `${storefrontUrl.replace(/\/$/, '')}/?theme_preview`
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
