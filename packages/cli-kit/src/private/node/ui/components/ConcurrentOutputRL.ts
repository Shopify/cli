import {OutputProcess} from '../../../../public/node/output.js'
import {AbortSignal} from '../../../../public/node/abort.js'
import {outputContextStore} from './ConcurrentOutput.js'

import {Writable} from 'stream'
import * as readline from 'readline'
import stripAnsi from 'strip-ansi'

const COLORS = [
  '\x1b[33m', // yellow
  '\x1b[36m', // cyan
  '\x1b[35m', // magenta
  '\x1b[32m', // green
  '\x1b[34m', // blue
]
const RESET = '\x1b[0m'
const MAX_PREFIX_COLUMN_SIZE = 25
const LINE_VERTICAL = '│'

export interface ConcurrentOutputRLOptions {
  processes: OutputProcess[]
  prefixColumnSize?: number
  abortSignal: AbortSignal
  showTimestamps?: boolean
  keepRunningAfterProcessesResolve?: boolean
  output?: NodeJS.WritableStream
  /**
   * Called just before log lines are written to the output stream.
   * Use this to clear any overlay (e.g. a status bar) that sits below
   * the scrolling log area so it doesn't leave stale copies on screen.
   */
  onWillWrite?: () => void
  /**
   * Called right after log lines have been written to the output stream.
   * Use this to redraw any overlay that was cleared by `onWillWrite`.
   */
  onDidWrite?: () => void
}

function currentTime(): string {
  const now = new Date()
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`)
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}

/**
 * Pure-Node replacement for the Ink-based ConcurrentOutput component.
 *
 * Uses `readline.clearLine` / `readline.cursorTo` to write formatted,
 * prefix-aligned log lines without any React or Ink dependency.
 *
 * The public contract mirrors the Ink version: each OutputProcess receives
 * a stdout and stderr Writable; every chunk is split on newlines, prefixed
 * with an optional timestamp + coloured process name, and written to the
 * destination stream.
 *
 * Returns a promise that resolves when all processes finish (unless
 * `keepRunningAfterProcessesResolve` is set).
 */
export async function renderConcurrentOutputRL({
  processes,
  prefixColumnSize,
  abortSignal,
  showTimestamps = true,
  keepRunningAfterProcessesResolve = false,
  output = process.stdout,
  onWillWrite,
  onDidWrite,
}: ConcurrentOutputRLOptions): Promise<void> {
  // ── prefix column width ──────────────────────────────────────────────
  const calculatedPrefixColumnSize = Math.min(
    prefixColumnSize ?? processes.reduce((max, p) => Math.max(max, p.prefix.length), 0),
    MAX_PREFIX_COLUMN_SIZE,
  )

  // ── colour assignment (stable per unique prefix) ─────────────────────
  const prefixIndex = new Map<string, number>()
  function colorForPrefix(prefix: string): string {
    let idx = prefixIndex.get(prefix)
    if (idx === undefined) {
      idx = prefixIndex.size
      prefixIndex.set(prefix, idx)
    }
    return COLORS[idx % COLORS.length]!
  }

  function formatPrefix(prefix: string): string {
    if (prefix.length > calculatedPrefixColumnSize) {
      return prefix.substring(0, calculatedPrefixColumnSize)
    }
    return `${' '.repeat(calculatedPrefixColumnSize - prefix.length)}${prefix}`
  }

  // ── line writer ──────────────────────────────────────────────────────
  function writeLine(prefix: string, text: string) {
    const color = colorForPrefix(prefix)
    const ts = showTimestamps ? `${currentTime()} ${LINE_VERTICAL} ` : ''
    const formattedPrefix = `${color}${formatPrefix(prefix)}${RESET}`
    const line = `${ts}${formattedPrefix} ${LINE_VERTICAL} ${text}\n`

    // Use readline to safely write over any partial line the terminal
    // may be buffering (e.g. a spinner from another process).
    readline.clearLine(output as NodeJS.WritableStream, 0)
    readline.cursorTo(output as NodeJS.WritableStream, 0)
    output.write(line)
  }

  // ── writable factory ─────────────────────────────────────────────────
  function createWritable(processPrefix: string): Writable {
    return new Writable({
      write(chunk, _encoding, next) {
        // Read the output context set by `useConcurrentOutputContext`.
        // This allows callers to override the prefix (e.g. per-extension
        // log lines) and control ANSI stripping — same as the Ink version.
        const context = outputContextStore.getStore()
        const prefix = context?.outputPrefix ?? processPrefix
        const shouldStripAnsi = context?.stripAnsi ?? true

        const log = chunk.toString('utf8').replace(/\n$/, '')
        const lines = shouldStripAnsi ? stripAnsi(log).split('\n') : log.split('\n')

        // Clear any overlay (e.g. status bar) once before writing all lines,
        // then redraw it once after — avoids flicker on multi-line chunks.
        onWillWrite?.()
        for (const line of lines) {
          writeLine(prefix, line)
        }
        onDidWrite?.()

        next()
      },
    })
  }

  // ── run processes ────────────────────────────────────────────────────
  const settled = Promise.allSettled(
    processes.map(async (proc) => {
      const stdout = createWritable(proc.prefix)
      const stderr = createWritable(proc.prefix)
      await proc.action(stdout, stderr, abortSignal)
    }),
  )

  const results = await settled

  // Surface the first error, same semantics as the Ink version.
  const firstError = results.find((r) => r.status === 'rejected')
  if (firstError && firstError.status === 'rejected') {
    if (!keepRunningAfterProcessesResolve) {
      throw firstError.reason as Error
    }
    // When keepRunning is true, swallow errors (mirrors Ink behaviour).
    return
  }

  if (keepRunningAfterProcessesResolve) {
    // Block forever – caller is expected to abort via the signal.
    await new Promise<void>((resolve) => {
      abortSignal.addEventListener('abort', () => resolve(), {once: true})
    })
  }
}
