import {CLI_TIMEOUT} from './constants.js'
import {createLogger, envFixture, executables} from './env.js'
import {stripAnsi} from '../helpers/strip-ansi.js'
import {execa, type Options as ExecaOptions} from 'execa'
import type {E2EEnv} from './env.js'
import type * as pty from 'node-pty'

export interface ExecResult {
  stdout: string
  stderr: string
  exitCode: number
}

export interface WaitForOutputOptions {
  timeoutMs?: number
  /** Cancel the wait early — frees the timer and removes the waiter entry. */
  signal?: AbortSignal
}

export interface SpawnedProcess {
  /**
   * Wait for a string to appear in the PTY output.
   * Pass a number for the legacy positional `timeoutMs` form, or an options
   * object to also supply an `AbortSignal` for cancellation.
   */
  waitForOutput(text: string, opts?: number | WaitForOutputOptions): Promise<void>
  /** Send a single key to the PTY */
  sendKey(key: string): void
  /** Send a line of text followed by Enter */
  sendLine(line: string): void
  /** Wait for the process to exit */
  waitForExit(timeoutMs?: number): Promise<number>
  /** Kill the process */
  kill(): void
  /** Get all output captured so far (ANSI stripped) */
  getOutput(): string
  /** The underlying node-pty process */
  readonly ptyProcess: pty.IPty
}

export interface CLIProcess {
  /** Execute a CLI command non-interactively via execa */
  exec(args: string[], opts?: {cwd?: string; env?: NodeJS.ProcessEnv; timeout?: number}): Promise<ExecResult>
  /** Execute the create-app binary non-interactively via execa */
  execCreateApp(args: string[], opts?: {cwd?: string; env?: NodeJS.ProcessEnv; timeout?: number}): Promise<ExecResult>
  /** Spawn an interactive CLI command via node-pty */
  spawn(args: string[], opts?: {cwd?: string; env?: NodeJS.ProcessEnv}): Promise<SpawnedProcess>
}

/**
 * Test-scoped fixture providing CLI process management.
 * Tracks all spawned processes and kills them in teardown.
 */
export const cliFixture = envFixture.extend<{cli: CLIProcess}>({
  cli: async ({env}, use) => {
    const spawnedProcesses: SpawnedProcess[] = []
    const cliLog = createLogger('cli')

    // When DEBUG=1, tee the subprocess streams to the parent so the CLI's
    // info/success boxes and progress messages appear live, while still
    // letting execa buffer and return the captured output.
    const runExeca = (bin: string, args: string[], execaOpts: ExecaOptions) => {
      const subprocess = execa('node', [bin, ...args], execaOpts)
      if (process.env.DEBUG === '1') {
        subprocess.stdout?.pipe(process.stdout, {end: false})
        subprocess.stderr?.pipe(process.stderr, {end: false})
      }
      return subprocess
    }

    const cli: CLIProcess = {
      async exec(args, opts = {}) {
        const timeout = opts.timeout ?? CLI_TIMEOUT.medium
        const execaOpts: ExecaOptions = {
          cwd: opts.cwd,
          env: {...env.processEnv, ...opts.env},
          timeout,
          reject: false,
        }

        cliLog.log(env, `exec: node ${executables.cli}`)
        cliLog.log(env, args.join(' '))

        const result = await runExeca(executables.cli, args, execaOpts)

        return {
          stdout: result.stdout ?? '',
          stderr: result.stderr ?? '',
          exitCode: result.exitCode ?? 1,
        }
      },

      async execCreateApp(args, opts = {}) {
        const timeout = opts.timeout ?? CLI_TIMEOUT.long
        const execaOpts: ExecaOptions = {
          cwd: opts.cwd,
          env: {...env.processEnv, ...opts.env},
          timeout,
          reject: false,
        }

        cliLog.log(env, `exec: node ${executables.createApp}`)
        cliLog.log(env, `app init ${args.join(' ')}`)

        const result = await runExeca(executables.createApp, args, execaOpts)

        return {
          stdout: result.stdout ?? '',
          stderr: result.stderr ?? '',
          exitCode: result.exitCode ?? 1,
        }
      },

      async spawn(args, opts = {}) {
        // Dynamic import to avoid requiring node-pty for Phase 1 tests
        const nodePty = await import('node-pty')

        const spawnEnv: {[key: string]: string} = {}
        for (const [key, value] of Object.entries({...env.processEnv, ...opts.env})) {
          if (value !== undefined) {
            spawnEnv[key] = value
          }
        }

        cliLog.log(env, `spawn: node ${executables.cli}`)
        cliLog.log(env, args.join(' '))

        const ptyProcess = nodePty.spawn('node', [executables.cli, ...args], {
          name: 'xterm-color',
          cols: 120,
          rows: 30,
          cwd: opts.cwd,
          env: spawnEnv,
        })

        let output = ''
        const outputWaiters: {text: string; resolve: () => void; reject: (err: Error) => void}[] = []

        ptyProcess.onData((data: string) => {
          output += data
          if (process.env.DEBUG === '1') {
            process.stdout.write(data)
          }

          // Check if any waiters are satisfied (check both raw and stripped
          // output). resolve() removes the waiter from outputWaiters internally,
          // so we iterate over a snapshot to avoid index shifting during the loop.
          const stripped = stripAnsi(output)
          for (const waiter of [...outputWaiters]) {
            if (stripped.includes(waiter.text) || output.includes(waiter.text)) {
              waiter.resolve()
            }
          }
        })

        let exitCode: number | undefined
        let exitResolve: ((code: number) => void) | undefined

        ptyProcess.onExit(({exitCode: code}) => {
          exitCode = code
          if (exitResolve) {
            exitResolve(code)
          }
          // Reject any remaining output waiters. reject() removes each waiter
          // from outputWaiters, so iterate over a snapshot to avoid skipping.
          for (const waiter of [...outputWaiters]) {
            waiter.reject(new Error(`Process exited (code ${code}) while waiting for output: "${waiter.text}"`))
          }
        })

        const spawned: SpawnedProcess = {
          ptyProcess,

          waitForOutput(text: string, opts: number | WaitForOutputOptions = {}) {
            const {timeoutMs = CLI_TIMEOUT.medium, signal} =
              typeof opts === 'number' ? {timeoutMs: opts, signal: undefined} : opts

            // Check if already in output (raw or stripped)
            if (stripAnsi(output).includes(text) || output.includes(text)) {
              return Promise.resolve()
            }
            if (signal?.aborted) {
              return Promise.reject(new Error(`Cancelled waiting for output: "${text}"`))
            }

            return new Promise<void>((resolve, reject) => {
              // eslint-disable-next-line prefer-const
              let waiter: {text: string; resolve: () => void; reject: (err: Error) => void}

              const removeWaiter = () => {
                const idx = outputWaiters.indexOf(waiter)
                if (idx >= 0) outputWaiters.splice(idx, 1)
              }

              const timer = setTimeout(() => {
                removeWaiter()
                reject(
                  new Error(
                    `Timed out after ${timeoutMs}ms waiting for output: "${text}"\n\nCaptured output:\n${stripAnsi(
                      output,
                    )}`,
                  ),
                )
              }, timeoutMs)

              waiter = {
                text,
                resolve: () => {
                  clearTimeout(timer)
                  removeWaiter()
                  resolve()
                },
                reject: (err) => {
                  clearTimeout(timer)
                  removeWaiter()
                  reject(err)
                },
              }
              outputWaiters.push(waiter)

              if (signal) {
                signal.addEventListener(
                  'abort',
                  () => {
                    clearTimeout(timer)
                    removeWaiter()
                    reject(new Error(`Cancelled waiting for output: "${text}"`))
                  },
                  {once: true},
                )
              }
            })
          },

          sendKey(key: string) {
            ptyProcess.write(key)
          },

          sendLine(line: string) {
            ptyProcess.write(`${line}\r`)
          },

          waitForExit(timeoutMs = CLI_TIMEOUT.short) {
            if (exitCode !== undefined) {
              return Promise.resolve(exitCode)
            }

            return new Promise<number>((resolve, reject) => {
              const timer = setTimeout(() => {
                reject(new Error(`Timed out after ${timeoutMs}ms waiting for process exit`))
              }, timeoutMs)

              exitResolve = (code) => {
                clearTimeout(timer)
                resolve(code)
              }
            })
          },

          kill() {
            try {
              ptyProcess.kill()
              // eslint-disable-next-line no-catch-all/no-catch-all
            } catch (_error) {
              // Process may already be dead
            }
          },

          getOutput() {
            return stripAnsi(output)
          },
        }

        spawnedProcesses.push(spawned)
        return spawned
      },
    }

    await use(cli)

    // Teardown: kill all spawned processes
    for (const proc of spawnedProcesses) {
      proc.kill()
    }
  },
})

export interface CLIContext {
  cli: CLIProcess
  appDir: string
}

export {type E2EEnv}
