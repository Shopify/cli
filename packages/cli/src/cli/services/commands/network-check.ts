/* eslint-disable no-warning-comments */
import {outputInfo, outputWarn, outputResult, outputContent, outputToken} from '@shopify/cli-kit/node/output'
import {captureOutput} from '@shopify/cli-kit/node/system'
import {platform} from 'os'
import {promises as dns} from 'dns'

// -- INTERFACES AND TYPES ---------------------------------------------------
interface PingStats {
  min?: number
  avg?: number
  max?: number
  jitter?: number
  packetLoss?: number
}

type Status = 'Good' | 'Warning' | 'Bad'
interface StatStatus {
  status: Status
  label: string
}

// -- HELPER FUNCTIONS -------------------------------------------------------

/**
 * Returns a status emoji and label based on a value and its thresholds.
 * @param value - The metric's value.
 * @param thresholds - An object with `warn` and `bad` thresholds.
 * @param higherIsBetter - If true, higher values are considered better.
 * @returns A status object with an emoji label and status text.
 */
function getStatStatus(value: number, thresholds: {warn: number; bad: number}, higherIsBetter = false): StatStatus {
  const good = {status: 'Good' as Status, label: '✅'}
  const warn = {status: 'Warning' as Status, label: '⚠️'}
  const bad = {status: 'Bad' as Status, label: '❌'}

  if (higherIsBetter) {
    if (value < thresholds.bad) return bad
    if (value < thresholds.warn) return warn
    return good
  }
  if (value > thresholds.bad) return bad
  if (value > thresholds.warn) return warn
  return good
}

function hasStdout(error: unknown): error is {stdout: string} {
  // Some system commands (via execa) reject with an error that includes a stdout string
  // We narrow defensively to avoid accessing properties on unknown
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candidate: any = error
  return typeof candidate?.stdout === 'string'
}

// -- CORE DIAGNOSTIC FUNCTIONS ----------------------------------------------

async function pingStats(host: string, count = 10): Promise<PingStats | undefined> {
  const isWindows = platform() === 'win32'
  const args = isWindows ? ['-n', String(count), host] : ['-c', String(count), '-n', '-q', host]

  try {
    const out = await captureOutput('ping', args)
    const stats: PingStats = {}

    const lossMatch = out.match(/(\d+)% packet loss/i) ?? out.match(/Lost = \d+ \((\d+)% loss\)/i)
    if (lossMatch) stats.packetLoss = Number(lossMatch[1])

    if (isWindows) {
      const minMatch = out.match(/Minimum = (\d+)ms/i)
      const maxMatch = out.match(/Maximum = (\d+)ms/i)
      const avgMatch = out.match(/Average = (\d+)ms/i)
      if (minMatch) stats.min = Number(minMatch[1])
      if (maxMatch) stats.max = Number(maxMatch[1])
      if (avgMatch) stats.avg = Number(avgMatch[1])
    } else {
      const summaryMatch = out.match(
        /min\/avg\/max\/(?:mdev|stddev)\s*=\s*([\d.]+)\/([\d.]+)\/([\d.]+)\/([\d.]+)\s*ms/i,
      )
      if (summaryMatch) {
        const [min, avg, max, jitter] = summaryMatch.slice(1).map(Number)
        Object.assign(stats, {min, avg, max, jitter})
      }
    }
    return Object.keys(stats).length > 0 ? stats : undefined
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return undefined
  }
}

async function dnsCheck(host: string): Promise<{address: string; time: number} | undefined> {
  try {
    const startTime = Date.now()
    const addresses = await dns.resolve(host)
    const time = Date.now() - startTime
    return {address: addresses[0] ?? '', time}
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return undefined
  }
}

/**
 * Discovers the Path MTU by sending pings with the "don't fragment" bit set.
 */
async function findMtu(host: string): Promise<number | undefined> {
  const currentPlatform = platform()
  const isWindows = currentPlatform === 'win32'
  const isLinux = currentPlatform === 'linux'
  const isDarwin = currentPlatform === 'darwin'

  // macOS (darwin) ping does not support setting the DF bit; skip gracefully
  if (isDarwin) return undefined
  let low = 1300
  let high = 1500
  let bestMtu = 0

  while (low <= high) {
    const mid = Math.floor(low + (high - low) / 2)
    // eslint-disable-next-line line-comment-position
    const size = isWindows ? mid : mid - 28 // Windows `-l` is payload, Unix `-s` is payload
    let args: string[]
    if (isWindows) {
      args = ['-f', '-l', String(size), '-n', '1', host]
    } else if (isLinux) {
      args = ['-M', 'do', '-s', String(size), '-c', '1', '-n', host]
    } else {
      args = ['-s', String(size), '-c', '1', host]
    }
    try {
      // eslint-disable-next-line no-await-in-loop, line-comment-position
      const out = await captureOutput('ping', args, {input: ''}) // provide empty input to prevent hanging
      if (out.includes('100% packet loss') || out.includes('1 packets transmitted, 0 packets received')) {
        high = mid - 1
      } else {
        bestMtu = mid
        low = mid + 1
      }
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error: unknown) {
      // On failure (e.g., "Frag needed"), we lower the search range
      if (hasStdout(error) && (error.stdout.includes('Frag') || error.stdout.includes('fragmentation'))) {
        high = mid - 1
      } else {
        // eslint-disable-next-line line-comment-position
        return undefined // Unrecoverable error
      }
    }
  }
  return bestMtu > 0 ? bestMtu : undefined
}

/**
 * Runs a traceroute to the specified host.
 */
async function traceRoute(host: string): Promise<string | undefined> {
  const currentPlatform = platform()
  const isWindows = currentPlatform === 'win32'
  const isDarwin = currentPlatform === 'darwin'

  const command = isWindows ? 'tracert' : 'traceroute'

  // Prefer fast, bounded flags to avoid long hangs (may need to slow down)
  let args: string[]
  if (isWindows) {
    // no DNS, 15 hops, 2s timeout per hop
    args = ['/d', '-h', '15', '-w', '2000', host]
  } else if (isDarwin) {
    // darwin: numeric, max 15 hops, 1 probe, 2s wait
    args = ['-n', '-m', '15', '-q', '1', '-w', '2', host]
  } else {
    // linux: similar flags
    args = ['-n', '-m', '15', '-q', '1', '-w', '2', host]
  }

  try {
    return await captureOutput(command, args, {input: ''})
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return undefined
  }
}

// -- MAIN SERVICE -------------------------------------------------------------

export async function networkCheckService(): Promise<void> {
  outputResult('Running network health check...')
  // TODO: If you have access to the store, you should run checks against that domain too.
  const host = 'api.shopify.com'

  // 1. DNS Check
  const dnsResult = await dnsCheck(host)
  if (dnsResult) {
    const dnsStatus = getStatStatus(dnsResult.time, {warn: 200, bad: 500})
    outputInfo(
      `${dnsStatus.label} DNS resolved ${host} to ${dnsResult.address} in ${dnsResult.time}ms (${dnsStatus.status})`,
    )
  } else {
    outputWarn(`❌ DNS resolution failed for ${host}.`)
  }

  // 2. Ping Check
  const stats = await pingStats(host)
  if (stats) {
    const {avg = 0, jitter = 0, packetLoss = 0} = stats
    const latencyStatus = getStatStatus(avg, {warn: 150, bad: 500})
    const jitterStatus = getStatStatus(jitter, {warn: 50, bad: 100})
    const lossStatus = getStatStatus(packetLoss, {warn: 1, bad: 3})

    outputInfo(`${latencyStatus.label} Latency: avg ${avg.toFixed(2)}ms (${latencyStatus.status})`)
    if (stats.jitter !== undefined) {
      outputInfo(`${jitterStatus.label} Jitter: ${jitter.toFixed(2)}ms (${jitterStatus.status})`)
    }
    outputInfo(`${lossStatus.label} Packet Loss: ${packetLoss}% (${lossStatus.status})`)
  } else {
    outputWarn('❌ Ping command failed. Is `ping` available in your system PATH?')
  }

  // 3. MTU Check
  const mtu = await findMtu(host)
  if (mtu) {
    // eslint-disable-next-line line-comment-position
    const mtuStatus = getStatStatus(mtu, {warn: 1472, bad: 1400}, true) // Higher is better
    outputInfo(`${mtuStatus.label} Path MTU: ${mtu} bytes (${mtuStatus.status})`)
    if (mtuStatus.status !== 'Good') {
      outputWarn('⚠️  A low MTU can cause issues with SSL/TLS and large data transfers.')
    }
  } else if (platform() === 'darwin') {
    outputInfo('Skipping MTU discovery on macOS (DF-bit not supported by ping).')
  } else {
    outputWarn('❌ MTU discovery failed.')
  }

  // 4. Traceroute
  outputInfo('\n🔍 Running traceroute to show the network path...')
  outputInfo('This shows the network hops from your computer to Shopify.')
  outputInfo('It can help identify issues with VPNs or complex corporate networks.')
  const trace = await traceRoute(host)
  if (trace) {
    outputInfo(outputContent`${outputToken.raw(trace)}`)
  } else {
    outputWarn('❌ Traceroute command failed. Is it available in your system PATH?')
  }

  outputResult('\nNetwork health check completed.')
}
