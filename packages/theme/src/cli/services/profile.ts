import {isStorefrontPasswordProtected} from '../utilities/theme-environment/storefront-session.js'
import {ensureValidPassword} from '../utilities/theme-environment/storefront-password-prompt.js'
import {fetchDevServerSession} from '../utilities/theme-environment/dev-server-session.js'
import {render} from '../utilities/theme-environment/storefront-renderer.js'
import {resolveAssetPath} from '../utilities/asset-path.js'
import {openURL} from '@shopify/cli-kit/node/system'
import {joinPath} from '@shopify/cli-kit/node/path'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {writeFile, tempDirectory} from '@shopify/cli-kit/node/fs'
import {outputInfo} from '@shopify/cli-kit/node/output'

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
    outputInfo(profileJson)
  } else {
    await openProfile(profileJson)
  }
}

async function openProfile(profileJson: string) {
  // Adapted from https://github.com/jlfwong/speedscope/blob/146477a8508a6d2da697cb0ea0a426ba81b3e8dc/bin/cli.js#L63
  let urlToOpen = await resolveAssetPath('speedscope', 'index.html')

  const filename = 'liquid-profile'
  const sourceBase64 = Buffer.from(profileJson).toString('base64')
  const jsSource = `speedscope.loadFileFromBase64(${JSON.stringify(filename)}, ${JSON.stringify(sourceBase64)})`

  const filePrefix = `speedscope-${Number(new Date())}-${process.pid}`
  const jsPath = joinPath(tempDirectory(), `${filePrefix}.js`)
  await writeFile(jsPath, jsSource)
  urlToOpen += `#localProfilePath=${jsPath}`

  // For some silly reason, the OS X open command ignores any query parameters or hash parameters
  // passed as part of the URL. To get around this weird issue, we'll create a local HTML file
  // that just redirects.
  const htmlPath = joinPath(tempDirectory(), `${filePrefix}.html`)
  await writeFile(htmlPath, `<script>window.location=${JSON.stringify(urlToOpen)}</script>`)

  urlToOpen = `file://${htmlPath}`
  await openURL(urlToOpen)
}
