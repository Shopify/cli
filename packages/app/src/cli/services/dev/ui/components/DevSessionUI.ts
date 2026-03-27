import metadata from '../../../../metadata.js'
import {
  DevSessionStatus,
  DevSessionStatusManager,
} from '../../processes/dev-session/dev-session-status-manager.js'
import {MAX_EXTENSION_HANDLE_LENGTH} from '../../../../models/extensions/schemas.js'
import {OutputProcess} from '@shopify/cli-kit/node/output'
import {renderConcurrentRL} from '@shopify/cli-kit/node/ui'
import {AbortController, AbortSignal} from '@shopify/cli-kit/node/abort'
import {openURL} from '@shopify/cli-kit/node/system'
import {isUnitTest} from '@shopify/cli-kit/node/context/local'
import {treeKill} from '@shopify/cli-kit/node/tree-kill'
import {postRunHookHasCompleted} from '@shopify/cli-kit/node/hooks/postrun'
import {Writable} from 'stream'
import * as readline from 'readline'

// ── Constants ──────────────────────────────────────────────────────────
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const CYAN = '\x1b[36m'
const UNDERLINE = '\x1b[4m'
const INVERSE = '\x1b[7m'
const POINTER = '›'
const LINE_V = '│'
const LINE_H = '─'

// ── Types ──────────────────────────────────────────────────────────────
interface DevSessionUIOptions {
  processes: OutputProcess[]
  abortController: AbortController
  devSessionStatusManager: DevSessionStatusManager
  shopFqdn: string
  appURL?: string
  appName?: string
  organizationName?: string
  configPath?: string
  onAbort: () => Promise<void>
}

type TabId = 'd' | 'a' | 's'

// ── Helpers ────────────────────────────────────────────────────────────
function link(url: string): string {
  // OSC 8 hyperlink: supported by most modern terminals
  return `\x1b]8;;${url}\x07${UNDERLINE}${url}${RESET}\x1b]8;;\x07`
}

function clearStatusArea(output: NodeJS.WritableStream, lineCount: number) {
  for (let i = 0; i < lineCount; i++) {
    readline.moveCursor(output, 0, -1)
    readline.clearLine(output, 0)
  }
}

// ── Main ───────────────────────────────────────────────────────────────

/**
 * Pure-Node replacement for the Ink-based DevSessionUI component.
 *
 * Renders concurrent process output via `renderConcurrentOutputRL`, then
 * draws an interactive status bar with tab navigation and keyboard
 * shortcuts using raw stdin + readline escape sequences.
 */
export async function renderDevSessionUI(options: DevSessionUIOptions): Promise<void> {
  const {
    abortController,
    processes,
    devSessionStatusManager,
    shopFqdn,
    appURL,
    appName,
    organizationName,
    configPath,
    onAbort,
  } = options

  const output = process.stdout
  const canUseShortcuts = process.stdin.isTTY ?? false

  let activeTab: TabId = 'd'
  let isAborted = false
  let error: string | undefined
  let isShuttingDown = false
  let shouldShowPersistentDevInfo = false
  let spinnerFrame = 0
  let spinnerTimer: ReturnType<typeof setInterval> | undefined
  let lastStatusLineCount = 0
  let status: DevSessionStatus = devSessionStatusManager.status

  // ── Wrap processes with error handling ──────────────────────────────
  const errorHandledProcesses = processes.map((proc) => ({
    ...proc,
    action: async (stdout: Writable, stderr: Writable, signal: AbortSignal) => {
      try {
        return await proc.action(stdout, stderr, signal)
      } catch (err) {
        abortController.abort(err)
      }
    },
  }))

  // ── Spinner ─────────────────────────────────────────────────────────
  function spinnerChar(): string {
    return SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length]!
  }

  function startSpinner() {
    if (spinnerTimer) return
    spinnerTimer = setInterval(() => {
      spinnerFrame++
      drawStatusBar()
    }, 70)
  }

  function stopSpinner() {
    if (spinnerTimer) {
      clearInterval(spinnerTimer)
      spinnerTimer = undefined
    }
  }

  // ── Status bar rendering ────────────────────────────────────────────
  function getStatusIndicator(type: string): string {
    switch (type) {
      case 'loading':
        return spinnerChar()
      case 'success':
        return '✅'
      case 'error':
        return '❌'
      default:
        return ''
    }
  }

  function buildDevStatusContent(): string[] {
    const lines: string[] = []

    if (status.statusMessage) {
      lines.push(`${getStatusIndicator(status.statusMessage.type)} ${status.statusMessage.message}`)
    }

    if (canUseShortcuts) {
      lines.push('')
      if (status.graphiqlURL && status.isReady) {
        lines.push(`${POINTER} ${BOLD}(g)${RESET} Open GraphiQL (Admin API) in your browser`)
      }
      if (status.isReady) {
        lines.push(`${POINTER} ${BOLD}(p)${RESET} Preview in your browser`)
      }
    }

    if (isShuttingDown) {
      lines.push('')
      lines.push('Shutting down dev ...')
    } else if (status.isReady) {
      lines.push('')
      if (status.previewURL) lines.push(`Preview URL: ${link(status.previewURL)}`)
      if (status.graphiqlURL) lines.push(`GraphiQL URL: ${link(status.graphiqlURL)}`)
    }

    return lines
  }

  function buildAppInfoContent(): string[] {
    const rows: [string, string][] = [
      ['App:', appName ?? ''],
      ['App URL:', appURL ?? ''],
      ['Config:', configPath?.split('/').pop() ?? ''],
      ['Org:', organizationName ?? ''],
    ].filter(([, value]) => value) as [string, string][]

    return rows.map(([label, value]) => `  ${label.padEnd(12)} ${value}`)
  }

  function buildStoreInfoContent(): string[] {
    const rows: [string, string][] = [
      ['Dev store:', link(`https://${shopFqdn}`)],
      ['Dev store admin:', link(`https://${shopFqdn}/admin`)],
      ['Org:', organizationName ?? ''],
    ].filter(([, value]) => value) as [string, string][]

    return rows.map(([label, value]) => `  ${label.padEnd(18)} ${value}`)
  }

  function buildPersistentDevInfo(): string[] {
    const lines: string[] = []
    lines.push('')
    lines.push(`${CYAN}╭─ info ${LINE_H.repeat(60)}╮${RESET}`)
    lines.push(`${CYAN}│${RESET}`)
    lines.push(`${CYAN}│${RESET}  A preview of your development changes is still available on ${shopFqdn}.`)
    lines.push(`${CYAN}│${RESET}  Run ${BOLD}shopify app dev clean${RESET} to restore the latest released version of your app.`)
    lines.push(`${CYAN}│${RESET}`)
    lines.push(`${CYAN}│${RESET}  Learn more about dev previews: ${link('https://shopify.dev/beta/developer-dashboard/shopify-app-dev')}`)
    lines.push(`${CYAN}│${RESET}`)
    lines.push(`${CYAN}╰${LINE_H.repeat(68)}╯${RESET}`)
    return lines
  }

  function drawStatusBar() {
    if (isAborted && !shouldShowPersistentDevInfo && !error) return

    // Clear previous status area
    if (lastStatusLineCount > 0) {
      clearStatusArea(output, lastStatusLineCount)
    }

    const lines: string[] = []

    if (shouldShowPersistentDevInfo) {
      lines.push(...buildPersistentDevInfo())
      if (error) {
        lines.push('')
        lines.push(`${RED}${error}${RESET}`)
      }
      // Write and don't redraw again
      const content = lines.join('\n') + '\n'
      output.write(content)
      lastStatusLineCount = lines.length
      return
    }

    if (isAborted) {
      if (error) {
        lines.push('')
        lines.push(`${RED}${error}${RESET}`)
      }
      const content = lines.join('\n') + '\n'
      output.write(content)
      lastStatusLineCount = lines.length
      return
    }

    // Tab header line
    const tabs: {id: TabId; label: string}[] = [
      {id: 'd', label: 'Dev status'},
      {id: 'a', label: 'App info'},
      {id: 's', label: 'Store info'},
    ]

    const cols = output instanceof process.stdout.constructor ? (process.stdout.columns || 80) : 80
    const headerSep = LINE_H.repeat(Math.min(cols - 1, 79))
    lines.push(headerSep)

    if (canUseShortcuts) {
      const tabHeaders = tabs.map((tab) => {
        const header = ` (${tab.id}) ${tab.label} `
        return tab.id === activeTab ? `${INVERSE}${header}${RESET}` : header
      })
      lines.push(`${LINE_V}${tabHeaders.join(LINE_V)}${LINE_V}${' '.repeat(Math.max(0, 20))}(q) Quit`)
    }

    // Tab content
    let content: string[]
    switch (activeTab) {
      case 'd':
        content = buildDevStatusContent()
        break
      case 'a':
        content = buildAppInfoContent()
        break
      case 's':
        content = buildStoreInfoContent()
        break
    }
    lines.push(...content)

    if (error) {
      lines.push('')
      lines.push(`${RED}${error}${RESET}`)
    }

    const rendered = lines.join('\n') + '\n'
    output.write(rendered)
    lastStatusLineCount = lines.length
  }

  // ── Keyboard input ──────────────────────────────────────────────────
  let cleanupInput: (() => void) | undefined

  function setupKeyboardInput() {
    if (!canUseShortcuts) return

    readline.emitKeypressEvents(process.stdin)
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(true)
    }
    process.stdin.resume()

    const onKeypress = async (_ch: string | undefined, key: readline.Key | undefined) => {
      if (!key) return

      // Ctrl+C
      if (key.ctrl && key.name === 'c') {
        abortController.abort()
        return
      }

      const input = key.name ?? key.sequence ?? ''

      // Tab navigation
      if (input === 'left' || input === 'right' || input === 'tab') {
        const contentTabs: TabId[] = ['d', 'a', 's']
        const currentIndex = contentTabs.indexOf(activeTab)
        const direction = input === 'left' ? -1 : 1
        const newIndex = (currentIndex + direction + contentTabs.length) % contentTabs.length
        activeTab = contentTabs[newIndex]!
        drawStatusBar()
        return
      }

      // Tab direct access
      if (input === 'd' || input === 'a' || input === 's') {
        activeTab = input
        drawStatusBar()
        return
      }

      // Quit
      if (input === 'q') {
        abortController.abort()
        return
      }

      // Shortcuts only active in dev status tab
      if (activeTab === 'd') {
        if (input === 'p' && status.previewURL && status.isReady) {
          await metadata.addPublicMetadata(() => ({
            cmd_dev_preview_url_opened: true,
          }))
          await openURL(status.previewURL)
        } else if (input === 'g' && status.graphiqlURL && status.isReady) {
          await metadata.addPublicMetadata(() => ({
            cmd_dev_graphiql_opened: true,
          }))
          await openURL(status.graphiqlURL)
        }
      }
    }

    process.stdin.on('keypress', onKeypress)

    cleanupInput = () => {
      process.stdin.off('keypress', onKeypress)
      if (process.stdin.setRawMode) {
        process.stdin.setRawMode(false)
      }
      process.stdin.pause()
    }
  }

  // ── Abort handling ──────────────────────────────────────────────────
  function handleAbort() {
    abortController.signal.addEventListener(
      'abort',
      async () => {
        isAborted = true
        const err = abortController.signal.reason
        if (err) {
          error = typeof err === 'string' ? err : (err as Error).message
        }

        const appPreviewReady = devSessionStatusManager.status.isReady
        if (appPreviewReady) {
          shouldShowPersistentDevInfo = true
        } else {
          isShuttingDown = true
          await onAbort()
        }

        stopSpinner()
        drawStatusBar()
        cleanupInput?.()

        if (isUnitTest()) return

        // Wait for the post run hook to complete or timeout after 5 seconds.
        let totalTime = 0
        const exitInterval = setInterval(() => {
          if (postRunHookHasCompleted() || totalTime > 5000) {
            clearInterval(exitInterval)
            treeKill(process.pid, 'SIGINT', false, () => {
              process.exit(0)
            })
          }
          totalTime += 100
        }, 100)
      },
      {once: true},
    )
  }

  // ── Status updates ──────────────────────────────────────────────────
  function onStatusUpdate(newStatus: DevSessionStatus) {
    status = newStatus
    if (status.statusMessage?.type === 'loading') {
      startSpinner()
    } else {
      stopSpinner()
    }
    drawStatusBar()
  }

  // ── Boot ────────────────────────────────────────────────────────────
  handleAbort()
  devSessionStatusManager.on('dev-session-update', onStatusUpdate)

  // Start spinner if initial status is loading
  if (status.statusMessage?.type === 'loading') {
    startSpinner()
  }

  // Start concurrent output (this writes process logs above the status bar)
  // The onWillWrite/onDidWrite hooks ensure the status bar is cleared before
  // each log line and redrawn after, preventing stale copies on screen.
  const concurrentPromise = renderConcurrentRL({
    processes: errorHandledProcesses,
    prefixColumnSize: MAX_EXTENSION_HANDLE_LENGTH,
    abortSignal: abortController.signal,
    keepRunningAfterProcessesResolve: true,
    output,
    onWillWrite: () => {
      if (lastStatusLineCount > 0) {
        clearStatusArea(output, lastStatusLineCount)
        lastStatusLineCount = 0
      }
    },
    onDidWrite: () => {
      drawStatusBar()
    },
  })

  // Draw initial status bar
  drawStatusBar()
  setupKeyboardInput()

  // Wait for concurrent output to finish (blocks until abort)
  await concurrentPromise

  // Cleanup
  stopSpinner()
  devSessionStatusManager.off('dev-session-update', onStatusUpdate)
  cleanupInput?.()
}
