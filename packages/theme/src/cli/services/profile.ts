import {openURL} from '@shopify/cli-kit/node/system'
import {ensureAuthenticatedStorefront} from '@shopify/cli-kit/node/session'
import {joinPath} from '@shopify/cli-kit/node/path'
import {writeFile} from 'fs/promises'
import {tmpdir} from 'os'

export async function profile(password: string | undefined, storeDomain: string, urlPath: string, asJson: boolean) {
  // Fetch the profiling from the Store
  const url = new URL(`https://${storeDomain}${urlPath}`)
  const storefrontToken = await ensureAuthenticatedStorefront([], password)
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${storefrontToken}`,
      Accept: 'application/vnd.speedscope+json',
    },
  })
  const contentType = response.headers.get('content-type')
  if (response.status !== 200 || contentType !== 'application/json') {
    const body = await response.text()
    throw new Error(`Bad response: ${response.status} (content-type: ${contentType}): ${body}`)
  }

  const profileJson = await response.text()

  if (asJson) {
    // Print the JSON
    process.stdout.write(profileJson)
  } else {
    await openProfile(profileJson)
  }
}

async function resolveSpeedscope() {
  if (import.meta.resolve) {
    return import.meta.resolve('speedscope/dist/release/index.html')
  } else {
    try {
      const speedscopePath = require.resolve('speedscope/package.json')
      const speedscopeDir = speedscopePath.replace('/package.json', '')
      return `file://${speedscopeDir}/dist/release/index.html`
    } catch (error) {
      throw new Error("Can't find Speedscope package")
    }
  }
}

async function openProfile(profileJson: string) {
  // Adapted from https://github.com/jlfwong/speedscope/blob/146477a8508a6d2da697cb0ea0a426ba81b3e8dc/bin/cli.js#L63
  let urlToOpen = await resolveSpeedscope()

  const filename = 'liquid-profile'
  const sourceBase64 = Buffer.from(profileJson).toString('base64')
  const jsSource = `speedscope.loadFileFromBase64(${JSON.stringify(filename)}, ${JSON.stringify(sourceBase64)})`

  const filePrefix = `speedscope-${Number(new Date())}-${process.pid}`
  const jsPath = joinPath(tmpdir(), `${filePrefix}.js`)
  await writeFile(jsPath, jsSource)
  urlToOpen += `#localProfilePath=${jsPath}`

  // For some silly reason, the OS X open command ignores any query parameters or hash parameters
  // passed as part of the URL. To get around this weird issue, we'll create a local HTML file
  // that just redirects.
  const htmlPath = joinPath(tmpdir(), `${filePrefix}.html`)
  await writeFile(htmlPath, `<script>window.location=${JSON.stringify(urlToOpen)}</script>`)

  urlToOpen = `file://${htmlPath}`
  await openURL(urlToOpen)
}
