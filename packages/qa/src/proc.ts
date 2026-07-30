/**
 * Process helpers for driving the CLI under test.
 *
 * `exec` runs non-interactive commands via execa.
 * `spawnPty` runs interactive commands (app dev, config link, hydrogen init)
 * in a pseudo-terminal so the CLI renders its interactive UI and accepts
 * keypresses — no browser or test framework involved.
 */
import * as fs from 'fs'
import * as path from 'path'
import {createRequire} from 'module'
import stripAnsi from 'strip-ansi'
import {execa} from 'execa'
import * as pty from 'node-pty'
import type {Ctx} from './context.js'

/**
 * pnpm extracts node-pty prebuilds without the executable bit on macOS/Linux,
 * which makes every pty.spawn fail with "posix_spawnp failed.". Fix it once.
 */
export function ensurePtySpawnHelperExecutable(): void {
  if (process.platform === 'win32') return
  try {
    const require = createRequire(import.meta.url)
    const packageDir = path.dirname(require.resolve('node-pty/package.json'))
    const prebuilds = path.join(packageDir, 'prebuilds')
    if (!fs.existsSync(prebuilds)) return
    for (const platformDir of fs.readdirSync(prebuilds)) {
      const helper = path.join(prebuilds, platformDir, 'spawn-helper')
      if (fs.existsSync(helper)) fs.chmodSync(helper, 0o755)
    }
  } catch {
    // Best effort — a real failure will surface as a spawn error with context.
  }
}

export interface ExecResult {
  stdout: string
  stderr: string
  exitCode: number
}

export interface ExecOptions {
  cwd?: string
  env?: {[key: string]: string}
  timeoutMs?: number
  /** Piped to stdin (used by `app function run`). */
  input?: string
}

const DEFAULT_EXEC_TIMEOUT = 5 * 60_000

export async function exec(ctx: Ctx, args: string[], opts: ExecOptions = {}): Promise<ExecResult> {
  const [command, ...prefix] = ctx.cliInvoke
  ctx.log(`$ shopify ${args.join(' ')}`)
  const cwd = opts.cwd ?? ctx.workDir
  const result = await execa(command as string, [...prefix, ...args], {
    cwd,
    env: {...ctx.env, ...opts.env, INIT_CWD: cwd, PWD: cwd},
    extendEnv: false,
    timeout: opts.timeoutMs ?? DEFAULT_EXEC_TIMEOUT,
    input: opts.input,
    reject: false,
    all: true,
  })
  return {
    stdout: stripAnsi(result.stdout ?? ''),
    stderr: stripAnsi(result.stderr ?? ''),
    exitCode: result.exitCode ?? 1,
  }
}

/** Throw with a readable error when a command exits non-zero. */
export function expectSuccess(result: ExecResult, what: string): ExecResult {
  if (result.exitCode !== 0) {
    throw new Error(`${what} exited with ${result.exitCode}\n--- output ---\n${tail(result.stdout + result.stderr)}`)
  }
  return result
}

export function tail(text: string, lines = 40): string {
  const all = text.split('\n')
  return all.slice(Math.max(0, all.length - lines)).join('\n')
}

export interface WaitOptions {
  timeoutMs?: number
}

export interface PtyProcess {
  /** Wait until the (ANSI-stripped) output matches. */
  waitFor(match: string | RegExp, opts?: WaitOptions): Promise<void>
  /** Send raw input, e.g. 'q', '\r', '\x03' (Ctrl+C). */
  write(data: string): void
  /** Send a line followed by Enter. */
  sendLine(line: string): void
  waitForExit(timeoutMs?: number): Promise<number>
  kill(): void
  /** All output captured so far, ANSI-stripped. */
  output(): string
  exited: boolean
}

const DEFAULT_WAIT_TIMEOUT = 3 * 60_000

export function spawnPty(
  ctx: Ctx,
  args: string[],
  opts: {cwd?: string; env?: {[key: string]: string}} = {},
): PtyProcess {
  const [command, ...prefix] = ctx.cliInvoke
  ctx.log(`$ shopify ${args.join(' ')} (pty)`)

  const cwd = opts.cwd ?? ctx.workDir
  const proc = pty.spawn(command as string, [...prefix, ...args], {
    name: 'xterm-color',
    cols: 120,
    rows: 40,
    cwd,
    env: {...ctx.env, ...opts.env, INIT_CWD: cwd, PWD: cwd},
  })

  let buffer = ''
  let exited = false
  let exitCode: number | undefined
  const exitWaiters: ((code: number) => void)[] = []
  interface Waiter {
    match: string | RegExp
    resolve: () => void
    from: number
  }
  const waiters: Waiter[] = []

  const matches = (match: string | RegExp, from: number): boolean => {
    const haystack = buffer.slice(from)
    return typeof match === 'string' ? haystack.includes(match) : match.test(haystack)
  }

  proc.onData((data) => {
    buffer += stripAnsi(data)
    for (let i = waiters.length - 1; i >= 0; i--) {
      const waiter = waiters[i] as Waiter
      if (matches(waiter.match, waiter.from)) {
        waiters.splice(i, 1)
        waiter.resolve()
      }
    }
  })

  proc.onExit(({exitCode: code}) => {
    exited = true
    exitCode = code
    while (exitWaiters.length) exitWaiters.shift()?.(code)
  })

  const handle: PtyProcess = {
    get exited() {
      return exited
    },
    output: () => buffer,
    write: (data) => proc.write(data),
    sendLine: (line) => proc.write(`${line}\r`),
    kill: () => {
      if (!exited) proc.kill()
    },
    waitFor: (match, waitOpts = {}) => {
      const from = 0
      if (matches(match, from)) return Promise.resolve()
      if (exited) {
        return Promise.reject(
          new Error(`Process exited (code ${exitCode}) before matching ${String(match)}\n--- output ---\n${tail(buffer)}`),
        )
      }
      return new Promise<void>((resolve, reject) => {
        const timeoutMs = waitOpts.timeoutMs ?? DEFAULT_WAIT_TIMEOUT
        const timer = setTimeout(() => {
          const index = waiters.findIndex((waiter) => waiter.resolve === wrapped)
          if (index >= 0) waiters.splice(index, 1)
          reject(new Error(`Timed out (${timeoutMs}ms) waiting for ${String(match)}\n--- output ---\n${tail(buffer)}`))
        }, timeoutMs)
        const wrapped = () => {
          clearTimeout(timer)
          resolve()
        }
        waiters.push({match, resolve: wrapped, from})
        exitWaiters.push(() => {
          const index = waiters.findIndex((waiter) => waiter.resolve === wrapped)
          if (index >= 0) {
            waiters.splice(index, 1)
            clearTimeout(timer)
            reject(
              new Error(
                `Process exited (code ${exitCode}) before matching ${String(match)}\n--- output ---\n${tail(buffer)}`,
              ),
            )
          }
        })
      })
    },
    waitForExit: (timeoutMs = DEFAULT_WAIT_TIMEOUT) => {
      if (exited) return Promise.resolve(exitCode ?? 0)
      return new Promise<number>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Timed out (${timeoutMs}ms) waiting for exit`)), timeoutMs)
        exitWaiters.push((code) => {
          clearTimeout(timer)
          resolve(code)
        })
      })
    },
  }

  ctx.state.ptyProcs.push(handle)
  return handle
}

/** Simple HTTP fetch helper with timeout; avoids extra deps (Node >=22 has fetch). */
export async function httpRequest(
  url: string,
  init: {method?: string; headers?: {[key: string]: string}; body?: string; timeoutMs?: number} = {},
): Promise<{status: number; body: string}> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 15_000)
  try {
    const response = await fetch(url, {
      method: init.method ?? 'GET',
      headers: init.headers,
      body: init.body,
      signal: controller.signal,
    })
    const body = await response.text()
    return {status: response.status, body}
  } finally {
    clearTimeout(timer)
  }
}

export async function retry<T>(fn: () => Promise<T>, attempts: number, delayMs: number): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await fn()
    } catch (error) {
      lastError = error
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
  throw lastError
}
