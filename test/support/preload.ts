import {http, HttpResponse, passthrough} from 'msw'
import {setupServer} from 'msw/node'
// Guard the native boundary, including calls that bypass CLI-kit's process helper.
// eslint-disable-next-line no-restricted-imports
import childProcess from 'node:child_process'
import {appendFileSync, readFileSync} from 'node:fs'
import {syncBuiltinESMExports} from 'node:module'
import net from 'node:net'
import {isDeepStrictEqual} from 'node:util'
// eslint-disable-next-line no-restricted-imports
import {basename} from 'node:path'
import type {CommandEvent, CommandState} from './protocol.js'

const state = JSON.parse(readFileSync(process.env.CLI_TEST_STATE!, 'utf8')) as CommandState
const tracePath = process.env.CLI_TEST_TRACE!
const counts = new Map<number, number>()
let requests = 0
const startedAt = performance.now()
const subprocessCounts = new Map<number, number>()
const nativeSpawn = childProcess.spawn
const nativeSpawnSync = childProcess.spawnSync
const nativeConnect = net.Socket.prototype.connect

function record(event: CommandEvent) {
  // Synchronous tracing survives process.exit(2), crashes, and swallowed errors.
  appendFileSync(tracePath, `${JSON.stringify({...event, elapsedMs: performance.now() - startedAt})}\n`)
}

function forbidden(message: string): never {
  record({type: 'violation', message})
  throw new Error(message)
}

const currentTime = () => state.now + (state.clock === 'advancing' ? Math.trunc(performance.now() - startedAt) : 0)
const NativeDate = Date
// Keep Date construction and Date.now consistent, without replacing real timers.
globalThis.Date = new Proxy(NativeDate, {
  construct(target, args, newTarget) {
    return Reflect.construct(target, args.length ? args : [currentTime()], newTarget)
  },
  apply() {
    return new NativeDate(currentTime()).toString()
  },
  get(target, property) {
    return property === 'now' ? currentTime : Reflect.get(target, property)
  },
})

const server = setupServer(
  http.all('*', async ({request}) => {
    // Ink loads its bundled Yoga WASM through a data URL; that is not network I/O.
    if (request.url.startsWith('data:')) return passthrough()
    const body = await request.text()
    let payload: {query?: string; variables?: Record<string, unknown>} = {}
    try {
      payload = JSON.parse(body || '{}')
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error
      // OAuth and other non-JSON requests still participate in URL/method matching.
    }
    const operation = payload.query?.match(/\b(?:query|mutation)\s+(\w+)/)?.[1]
    const headers = Object.fromEntries(request.headers)
    record({
      type: 'request',
      url: request.url,
      method: request.method,
      operation,
      variables: payload.variables,
      headers,
      body,
    })
    requests += 1
    if (requests > state.requestLimit) {
      record({type: 'violation', message: 'Request ceiling exceeded'})
      process.exit(97)
    }
    const index = state.requests.findIndex(
      (fixture) =>
        fixture.method === request.method &&
        fixture.url === request.url &&
        (fixture.operation === undefined || fixture.operation === operation) &&
        (fixture.variables === undefined || isDeepStrictEqual(fixture.variables, payload.variables ?? {})) &&
        Object.entries(fixture.form ?? {}).every(([key, value]) => new URLSearchParams(body).get(key) === value) &&
        Object.entries(fixture.headers ?? {}).every(([key, value]) => request.headers.get(key) === value),
    )
    if (index === -1) return forbidden(`Unregistered request: ${request.method} ${request.url} ${operation ?? ''}`)
    if (state.requests[index]!.passthrough) return passthrough()
    const used = counts.get(index) ?? 0
    const fixture = state.requests[index]!
    const response = fixture.responses[used] ?? (fixture.repeatLastResponse ? fixture.responses.at(-1) : undefined)
    if (!response) return forbidden(`Response sequence exhausted: ${operation ?? request.url}`)
    counts.set(index, used + 1)
    if (response.delayMs) await new Promise((resolve) => setTimeout(resolve, response.delayMs))
    if (response.disconnect) return HttpResponse.error()
    const options = {status: response.status ?? 200, headers: response.headers}
    return response.text === undefined
      ? HttpResponse.json(response.body as Parameters<typeof HttpResponse.json>[0], options)
      : new HttpResponse(response.text, options)
  }),
)
server.listen({onUnhandledRequest: 'error'})

// MSW covers Node HTTP(S) and native fetch. This second barrier prevents a missed
// transport (including an SDK) from opening a real socket.
net.Socket.prototype.connect = function (...args: unknown[]) {
  const first = Array.isArray(args[0]) ? args[0][0] : args[0]
  const options = first as {host?: string; port?: string | number} | undefined
  if (
    options &&
    ['127.0.0.1', '::1'].includes(options.host ?? '') &&
    state.loopbackPorts.includes(Number(options.port))
  ) {
    return Reflect.apply(nativeConnect, this, args)
  }
  return forbidden('Unintercepted socket connection')
}

for (const name of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork'] as const) {
  Object.defineProperty(childProcess, name, {
    configurable: true,
    value: (command: string, args: string[] = [], options: childProcess.SpawnOptions = {}) => {
      record({type: 'spawn', command, args, message: name})
      const index = state.subprocesses.findIndex(
        (fixture) =>
          (fixture.command === command || fixture.command === basename(command)) &&
          (fixture.args === undefined || isDeepStrictEqual(fixture.args, args)),
      )
      const fixture = state.subprocesses[index]
      const used = subprocessCounts.get(index) ?? 0
      if (!fixture || used >= (fixture.maxCalls ?? 1) || (name !== 'spawn' && name !== 'spawnSync')) {
        return forbidden(`Unexpected command-owned subprocess: ${name} ${command}`)
      }
      subprocessCounts.set(index, used + 1)
      const stubArguments = [process.env.CLI_TEST_SUBPROCESS!, JSON.stringify(fixture)]
      // Never execute the requested browser/package manager, even for allowed calls.
      if (name === 'spawnSync') return nativeSpawnSync(process.execPath, stubArguments, options)
      const child = nativeSpawn(process.execPath, stubArguments, {...options, detached: false})
      // Join even a normally detached opener so no fixture child outlives cleanup.
      child.unref = () => child
      return child
    },
  })
}
syncBuiltinESMExports()
record({type: 'ready', pid: process.pid})
process.on('exit', () => record({type: 'exit', pid: process.pid}))
