import {isStorefrontPasswordProtected} from '../utilities/theme-environment/storefront-session.js'
import {ensureValidPassword} from '../utilities/theme-environment/storefront-password-prompt.js'
import {fetchDevServerSession} from '../utilities/theme-environment/dev-server-session.js'
import {render} from '../utilities/theme-environment/storefront-renderer.js'
import {resolveAssetPath} from '../utilities/asset-path.js'
import {DevServerSession} from '../utilities/theme-environment/types.js'
import {openURL, sleep} from '@shopify/cli-kit/node/system'
import {joinPath} from '@shopify/cli-kit/node/path'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {writeFile, tempDirectory} from '@shopify/cli-kit/node/fs'
import {outputResult, outputDebug, outputInfo} from '@shopify/cli-kit/node/output'

interface SpeedscopeFrame {
  name: string
}

interface SpeedscopeEvent {
  type: 'O' | 'C'
  frame: number
  at: number
}

interface SpeedscopeProfile {
  type: string
  unit?: string
  events?: SpeedscopeEvent[]
  samples?: number[][]
  weights?: number[]
  startValue?: number
  endValue?: number
}

interface SpeedscopeData {
  shared: {
    frames: SpeedscopeFrame[]
  }
  profiles: SpeedscopeProfile[]
}

interface FrameResult {
  name: string
  time: number
  timeRaw: number
  percent: number
}

interface FrameAnalysisResult {
  results: FrameResult[]
  unit: string
  conversionFactor: number
  grandTotalTime: number
  grandTotalTimeConverted: number
}

function analyzeSpeedscopeFrames(jsonString: string, substr: string): FrameAnalysisResult {
  const speedscope: SpeedscopeData = JSON.parse(jsonString)
  const substrLower = substr.toLowerCase()

  const frames = speedscope.shared.frames
  const frameIdToName = frames.map((frame) => frame.name)

  const frameStats: {[frameId: number]: {name: string; time: number}} = {}
  let grandTotalTime = 0.0
  let unit = 'ms'
  let conversionFactor = 1.0

  for (const profile of speedscope.profiles ?? []) {
    const profileType = profile.type

    if (profile.type === 'evented' && profile.unit === 'nanoseconds') {
      unit = 'ms'
      // nanoseconds to milliseconds
      conversionFactor = 1_000_000.0
    } else if (profile.unit) {
      unit = profile.unit
    }

    if (profileType === 'evented') {
      const stack: {frame: number; start: number}[] = []
      const events = profile.events ?? []
      let lastTimestamp: number | null = null

      for (const event of events) {
        const frameIdx = event.frame
        const timestamp = event.at

        if (lastTimestamp !== null && stack.length > 0) {
          const delta = timestamp - lastTimestamp
          for (const frameInfo of stack) {
            if (!frameStats[frameInfo.frame]) {
              frameStats[frameInfo.frame] = {
                name: frameIdToName[frameInfo.frame] ?? '',
                time: 0.0,
              }
            }
            const frameData = frameStats[frameInfo.frame]
            if (frameData) {
              frameData.time += delta
            }
          }
        }

        switch (event.type) {
          // Open event - push frame onto stack
          case 'O': {
            stack.push({frame: frameIdx, start: timestamp})
            break
          }
          // Close event - pop frame from stack
          case 'C': {
            const index = stack.findIndex((frameInfo) => frameInfo.frame === frameIdx)
            if (index !== -1) {
              stack.splice(index, 1)
            }
            break
          }
        }

        lastTimestamp = timestamp
      }

      if (profile.startValue !== undefined && profile.endValue !== undefined) {
        grandTotalTime += profile.endValue - profile.startValue
      }
    } else {
      const samples = profile.samples
      const weights = profile.weights ?? (samples ? new Array(samples.length).fill(1.0) : [])

      if (samples && weights) {
        for (let i = 0; i < samples.length; i++) {
          const stack = samples[i]
          const weight = weights[i]
          if (stack && typeof weight === 'number') {
            for (const frameIdx of stack) {
              if (!frameStats[frameIdx]) {
                frameStats[frameIdx] = {
                  name: frameIdToName[frameIdx] ?? '',
                  time: 0.0,
                }
              }
              frameStats[frameIdx].time += weight
            }
            grandTotalTime += weight
          }
        }
      }
    }
  }

  const results = Object.values(frameStats)
    .filter((frameData) => frameData.name.toLowerCase().includes(substrLower))
    .sort((frameA, frameB) => frameB.time - frameA.time)
    .map((frameData) => ({
      name: frameData.name,
      time: frameData.time / conversionFactor,
      timeRaw: frameData.time,
      // Round to 2 decimal places
      percent: Math.round((frameData.time / grandTotalTime) * 100 * 100) / 100,
    }))

  return {
    results,
    unit,
    conversionFactor,
    grandTotalTime,
    grandTotalTimeConverted: grandTotalTime / conversionFactor,
  }
}

async function runFrameAnalysis(
  session: DevServerSession,
  url: string,
  themeId: string,
  frameFilter: string,
  iterations: number,
) {
  outputInfo(`Frame Name\t\t\tTotal\t\tPercent`)

  for (let i = 0; i < iterations; i++) {
    // eslint-disable-next-line no-await-in-loop
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
      // eslint-disable-next-line no-await-in-loop
      const body = await response.text()
      throw new Error(`Bad response: ${response.status}: ${body}`)
    }

    // eslint-disable-next-line no-await-in-loop
    const profileJson = await response.text()
    const analysis = analyzeSpeedscopeFrames(profileJson, frameFilter)

    for (const frame of analysis.results) {
      outputInfo(`${frame.name}\t${frame.time.toFixed(3)}${analysis.unit}\t\t${frame.percent}%`)
    }

    // Sleep for 1 second between iterations (except for the last one)
    if (i < iterations - 1) {
      // eslint-disable-next-line no-await-in-loop
      await sleep(1)
    }
  }
}

export async function profile(
  adminSession: AdminSession,
  themeId: string,
  url: string,
  asJson: boolean,
  themeAccessPassword?: string,
  storefrontPassword?: string,
  frameFilter?: string,
  iterations?: number,
) {
  const storePassword = (await isStorefrontPasswordProtected(adminSession))
    ? await ensureValidPassword(storefrontPassword, adminSession.storeFqdn)
    : undefined

  const session = await fetchDevServerSession(themeId, adminSession, themeAccessPassword, storePassword)

  // If frame analysis is requested
  if (frameFilter && iterations) {
    await runFrameAnalysis(session, url, themeId, frameFilter, iterations)
    return
  }

  // Original profile functionality
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
