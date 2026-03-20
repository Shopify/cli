/* eslint-disable no-console */
import {envFixture, executables} from './env.js'
import {stripAnsi} from '../helpers/strip-ansi.js'
import {execa, type Options as ExecaOptions} from 'execa'
import type {E2EEnv} from './env.js'
import type * as pty from 'node-pty'

export interface ExecResult {
  stdout: string
  stderr: string
  exitCode: number
}

export interface SpawnedProcess {
  /** Wait for a string to appear in the PTY output */
  waitForOutput(text: string, timeoutMs?: number): Promise<void>
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

    const cli: CLIProcess = {
      async exec(args, opts = {}) {
        // 3 min default
        const timeout = opts.timeout ?? 3 * 60 * 1000
        const execEnv: {[key: string]: string} = {}
        for (const [key, value] of Object.entries({...env.processEnv, ...opts.env})) {
          if (value !== undefined) {
            execEnv[key] = value
          }
        }
        const execaOpts: ExecaOptions = {
          cwd: opts.cwd,
          env: execEnv,
          extendEnv: false,
          timeout,
          reject: false,
        }

        if (process.env.DEBUG === '1') {
          console.log(`[e2e] exec: node ${executables.cli} ${args.join(' ')}`)
        }

        const result = await execa('node', [executables.cli, ...args], execaOpts)

        return {
          stdout: result.stdout ?? '',
          stderr: result.stderr ?? '',
          exitCode: result.exitCode ?? 1,
        }
      },

      async execCreateApp(args, opts = {}) {
        // 5 min default for scaffolding
        const timeout = opts.timeout ?? 5 * 60 * 1000
        const execEnv: {[key: string]: string} = {}
        for (const [key, value] of Object.entries({...env.processEnv, ...opts.env})) {
          if (value !== undefined) {
            execEnv[key] = value
          }
        }
        const execaOpts: ExecaOptions = {
          cwd: opts.cwd,
          env: execEnv,
          extendEnv: false,
          timeout,
          reject: false,
        }

        if (process.env.DEBUG === '1') {
          console.log(`[e2e] exec: node ${executables.createApp} ${args.join(' ')}`)
        }

        const result = await execa('node', [executables.createApp, ...args], execaOpts)

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

        if (process.env.DEBUG === '1') {
          console.log(`[e2e] spawn: node ${executables.cli} ${args.join(' ')}`)
        }

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

          // Check if any waiters are satisfied (check both raw and stripped output)
          const stripped = stripAnsi(output)
          for (let idx = outputWaiters.length - 1; idx >= 0; idx--) {
            const waiter = outputWaiters[idx]
            if (waiter && (stripped.includes(waiter.text) || output.includes(waiter.text))) {
              waiter.resolve()
              outputWaiters.splice(idx, 1)
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
          // Reject any remaining output waiters
          for (const waiter of outputWaiters) {
            waiter.reject(new Error(`Process exited (code ${code}) while waiting for output: "${waiter.text}"`))
          }
          outputWaiters.length = 0
        })

        const spawned: SpawnedProcess = {
          ptyProcess,

          waitForOutput(text: string, timeoutMs = 3 * 60 * 1000) {
            // Check if already in output (raw or stripped)
            if (stripAnsi(output).includes(text) || output.includes(text)) {
              return Promise.resolve()
            }

            return new Promise<void>((resolve, reject) => {
              const timer = setTimeout(() => {
                const waiterIdx = outputWaiters.findIndex((waiter) => waiter.text === text)
                if (waiterIdx >= 0) outputWaiters.splice(waiterIdx, 1)
                reject(
                  new Error(
                    `Timed out after ${timeoutMs}ms waiting for output: "${text}"\n\nCaptured output:\n${stripAnsi(
                      output,
                    )}`,
                  ),
                )
              }, timeoutMs)

              outputWaiters.push({
                text,
                resolve: () => {
                  clearTimeout(timer)
                  resolve()
                },
                reject: (err) => {
                  clearTimeout(timer)
                  reject(err)
                },
              })
            })
          },

          sendKey(key: string) {
            ptyProcess.write(key)
          },

          sendLine(line: string) {
            ptyProcess.write(`${line}\r`)
          },

          waitForExit(timeoutMs = 60 * 1000) {
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

export {type E2EEnv}
