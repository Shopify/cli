// The harness must supervise native processes without importing CLI runtime state.
// eslint-disable-next-line no-restricted-imports
import {spawn} from 'node:child_process'
import {readFileSync} from 'node:fs'
import {stripVTControlCharacters} from 'node:util'
import type {CommandEvent} from './protocol.js'

export interface TerminalOptions {
  replies: {waitFor: string; input: string | string[]}[]
}

interface ExecutionOptions {
  env: NodeJS.ProcessEnv
  cwd: string
  argv: string[]
  timeoutMs: number
  stdin?: string
  terminal?: TerminalOptions
  terminateAfterStdout?: (stdout: string) => boolean
}

interface ExecutionResult {
  stdout: string
  stderr: string
  terminalOutput: string
  answeredPrompts: string[]
  exitCode: number | null
  signal: NodeJS.Signals | null
  timedOut: boolean
  terminatedAfterStdout: boolean
}

function quoteArgument(value: string) {
  return `'${value.replaceAll("'", "'\\''")}'`
}

function terminalArguments(args: string[]) {
  if (process.platform === 'darwin') {
    return ['--noprofile', '--norc', '-c', 'exec /usr/bin/script -q /dev/null bash "$@" < <(cat)', 'pty-test', ...args]
  }
  return [
    '--noprofile',
    '--norc',
    '-c',
    'exec script -qefc "$1" /dev/null < <(cat)',
    'pty-test',
    ['bash', ...args].map(quoteArgument).join(' '),
  ]
}

function terminateCommand(env: NodeJS.ProcessEnv) {
  // forkpty creates a separate process group. Kill the CLI recorded by our own
  // preload as well as script, rather than leaving a polling process orphaned.
  const events: CommandEvent[] = readFileSync(env.CLI_TEST_TRACE!, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
  for (const event of events.filter((event) => event.type === 'ready')) {
    if (!event.pid || events.some((entry) => entry.type === 'exit' && entry.pid === event.pid)) continue
    try {
      process.kill(event.pid, 'SIGKILL')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error
    }
  }
}

export async function runInBash(options: ExecutionOptions): Promise<ExecutionResult> {
  const args = ['--noprofile', '--norc', '-c', 'exec shopify "$@"', 'command-test', ...options.argv]
  const terminal = options.terminal
  // On macOS, script rejects libuv's socket-backed stdin. A real pipe from cat
  // supplies its input; the outer bash exec keeps a single supervised process.
  const launchArgs = terminal ? terminalArguments(args) : args
  // Native process APIs are deliberate: the CLI's module graph belongs in the child.
  const child = spawn('bash', launchArgs, {cwd: options.cwd, env: options.env, stdio: ['pipe', 'pipe', 'pipe']})
  const result: ExecutionResult = {
    stdout: '',
    stderr: '',
    terminalOutput: '',
    answeredPrompts: [],
    exitCode: null,
    signal: null,
    timedOut: false,
    terminatedAfterStdout: false,
  }
  let consumed = 0
  let searchFrom = 0
  let outputTerminationTimer: ReturnType<typeof setTimeout> | undefined
  const inputTimers = new Set<ReturnType<typeof setTimeout>>()
  const timer = setTimeout(() => {
    result.timedOut = true
    terminateCommand(options.env)
    child.kill('SIGKILL')
  }, options.timeoutMs)
  try {
    child.stdout.on('data', (chunk: Buffer) => {
      const data = chunk.toString()
      if (!terminal) {
        result.stdout += data
        if (!outputTerminationTimer && options.terminateAfterStdout?.(result.stdout)) {
          // Give the command a chance to exit naturally. If it remains alive,
          // terminate it after the caller has observed complete output.
          outputTerminationTimer = setTimeout(() => {
            result.terminatedAfterStdout = true
            terminateCommand(options.env)
            child.kill('SIGKILL')
          }, 100)
        }
        return
      }
      // PTYs intentionally merge stdout/stderr. Never label this stream as JSON stdout.
      result.terminalOutput += data
      const next = terminal.replies[consumed]
      const visible = stripVTControlCharacters(result.terminalOutput)
      if (next && visible.slice(searchFrom).includes(next.waitFor)) {
        consumed += 1
        searchFrom = visible.length
        result.answeredPrompts.push(next.waitFor)
        // Let Ink finish attaching raw-input effects. Keep text and Enter in
        // separate packets so paste handling cannot consume Enter as text.
        const chunks = typeof next.input === 'string' ? [next.input] : next.input
        chunks.forEach((input, index) => {
          const pending = setTimeout(
            () => {
              inputTimers.delete(pending)
              child.stdin.write(input)
            },
            50 * (index + 1),
          )
          inputTimers.add(pending)
        })
      }
    })
    child.stderr.on('data', (chunk: Buffer) => {
      result.stderr += chunk.toString()
    })
    child.stdin.on('error', () => {
      /* Parser errors or Ctrl-C can close stdin early. */
    })
    if (!terminal) child.stdin.end(options.stdin ?? '')
    await new Promise<void>((resolve, reject) => {
      child.once('error', reject)
      child.once('exit', () => child.stdin.end())
      child.once('close', (code, signal) => {
        result.exitCode = code
        result.signal = signal
        resolve()
      })
    })
    if (!result.timedOut && terminal && consumed !== terminal.replies.length) {
      throw new Error(
        `Unanswered prompt: ${terminal.replies[consumed]?.waitFor}\n${result.stderr}${result.terminalOutput}`,
      )
    }
    return result
  } finally {
    clearTimeout(timer)
    if (outputTerminationTimer) clearTimeout(outputTerminationTimer)
    for (const pending of inputTimers) clearTimeout(pending)
    child.stdin.destroy()
    if (child.exitCode === null && child.signalCode === null) {
      terminateCommand(options.env)
      child.kill('SIGKILL')
    }
  }
}
