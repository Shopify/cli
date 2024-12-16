import {writeFile} from 'fs/promises'
import {join, resolve, dirname} from 'path'
import {tmpdir} from 'os'
import {fileURLToPath} from 'url'
import {openURL} from '@shopify/cli-kit/node/system'
import {AdminSession, ensureAuthenticatedStorefront} from '@shopify/cli-kit/node/session'

export async function profile(
  adminSession: AdminSession,
  password: string | undefined,
  storeDomain: string,
  urlPath: string,
  asJson: boolean,
) {
  // Fetch the profiling from the Store
  const url = new URL(`https://${storeDomain}/${urlPath}`)
  url.searchParams.append('profile_liquid', '1')
  const storefrontToken = await ensureAuthenticatedStorefront([], password)
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${storefrontToken}`,
    },
  })
  const profileJson = await response.text()

  if (asJson) {
    // Print the JSON
    process.stdout.write(profileJson)
  } else {
    await openProfile(profileJson)
  }
}

async function openProfile(profileJson: string) {
  // Adapted from https://github.com/jlfwong/speedscope/blob/146477a8508a6d2da697cb0ea0a426ba81b3e8dc/bin/cli.js#L63
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = dirname(__filename)
  let urlToOpen = 'file://' + resolve(__dirname, '../../../node_modules/speedscope/dist/release/index.html')
  const filename = 'liquid-profile'

  const sourceBase64 = Buffer.from(profileJson).toString('base64')
  const jsSource = `speedscope.loadFileFromBase64(${JSON.stringify(filename)}, ${JSON.stringify(sourceBase64)})`

  const filePrefix = `speedscope-${+new Date()}-${process.pid}`
  const jsPath = join(tmpdir(), `${filePrefix}.js`)
  await writeFile(jsPath, jsSource)
  urlToOpen += `#localProfilePath=${jsPath}`

  // For some silly reason, the OS X open command ignores any query parameters or hash parameters
  // passed as part of the URL. To get around this weird issue, we'll create a local HTML file
  // that just redirects.
  const htmlPath = join(tmpdir(), `${filePrefix}.html`)
  await writeFile(htmlPath, `<script>window.location=${JSON.stringify(urlToOpen)}</script>`)

  urlToOpen = `file://${htmlPath}`
  await openURL(urlToOpen)
}
