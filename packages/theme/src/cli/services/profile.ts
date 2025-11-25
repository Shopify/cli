import {isStorefrontPasswordProtected} from '../utilities/theme-environment/storefront-session.js'
import {ensureValidPassword} from '../utilities/theme-environment/storefront-password-prompt.js'
import {fetchDevServerSession} from '../utilities/theme-environment/dev-server-session.js'
import {render} from '../utilities/theme-environment/storefront-renderer.js'
import {resolveAssetPath} from '../utilities/asset-path.js'
import {openURL} from '@shopify/cli-kit/node/system'
import {joinPath} from '@shopify/cli-kit/node/path'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {writeFile, tempDirectory} from '@shopify/cli-kit/node/fs'
import {outputResult, outputDebug} from '@shopify/cli-kit/node/output'
import {AbortError} from '@shopify/cli-kit/node/error'

export async function profile(
  adminSession: AdminSession,
  themeId: string,
  url: string,
  asJson: boolean,
  themeAccessPassword?: string,
  storefrontPassword?: string,
) {
  const storePassword = (await isStorefrontPasswordProtected(adminSession))
    ? await ensureValidPassword(storefrontPassword, adminSession.storeFqdn)
    : undefined

  if (themeAccessPassword) {
    throw new AbortError(
      'Unable to use Admin API or Theme Access tokens with the profile command',
      'You must authenticate manually by not passing the --password flag.',
    )
  }

  const session = await fetchDevServerSession(themeId, adminSession, themeAccessPassword, storePassword)
  const response = await render(session, {
    method: 'GET',
    path: url,
    query: [],
    themeId,
    headers: {
      Accept: 'application/vnd.speedscope+json',
    },
  })

  if (response.status !== 200) {
    const body = await response.text()
    throw new Error(`Bad response: ${response.status}: ${body}`)
  }

  const profileJson = await response.text()

  if (asJson) {
    // Print the JSON
    outputResult(profileJson)
  } else {
    await openProfile(profileJson)
  }
}

async function openProfile(profileJson: string) {
  // Adapted from https://github.com/jlfwong/speedscope/blob/146477a8508a6d2da697cb0ea0a426ba81b3e8dc/bin/cli.js#L63
  let urlToOpen = await resolveAssetPath('speedscope', 'index.html')
  outputDebug(`[Theme Profile] Resolved URL to open: ${urlToOpen}`)

  const filename = 'liquid-profile'
  const sourceBase64 = Buffer.from(profileJson).toString('base64')
  const jsSource = `speedscope.loadFileFromBase64(${JSON.stringify(filename)}, ${JSON.stringify(sourceBase64)})`

  const filePrefix = `speedscope-${Number(new Date())}-${process.pid}`
  const jsPath = joinPath(tempDirectory(), `${filePrefix}.js`)
  outputDebug(`[Theme Profile] writing JS file to: ${jsPath}`)
  await writeFile(jsPath, jsSource)
  outputDebug(`[Theme Profile] JS file created successfully: ${jsPath}`)
  urlToOpen += `#localProfilePath=${jsPath}`

  // For some silly reason, the OS X open command ignores any query parameters or hash parameters
  // passed as part of the URL. To get around this weird issue, we'll create a local HTML file
  // that just redirects.
  const htmlPath = joinPath(tempDirectory(), `${filePrefix}.html`)
  outputDebug(`[Theme Profile] writing HTML file to: ${htmlPath}`)
  await writeFile(htmlPath, `<script>window.location=${JSON.stringify(urlToOpen)}</script>`)
  outputDebug(`[Theme Profile] HTML file created successfully: ${htmlPath}`)

  urlToOpen = `file://${htmlPath}`
  outputDebug(`[Theme Profile] Opening URL: ${urlToOpen}`)
  const opened = await openURL(urlToOpen)
  outputDebug(`[Theme Profile] URL opened successfully: ${opened}`)
}
