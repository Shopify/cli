import {Cell, StyledTable} from './StyledTable.js'
import {palette, paint} from '../palette.js'
import {DevSessionAlert, DevSessionOutput, DevSessionStatus} from '../DevSessionOutput.js'
import {Box, Text, useInput, useStdin, useStdout} from '@shopify/cli-kit/node/ink'
import {handleCtrlC, TokenItem} from '@shopify/cli-kit/node/ui'
import {useAbortSignal} from '@shopify/cli-kit/node/ui/hooks'
import {AbortController} from '@shopify/cli-kit/node/abort'
import React, {FunctionComponent, useEffect, useState} from 'react'

/**
 * Visible-window floor: the log panel always shows at least this many rows,
 * even on a very short terminal.
 */
const MIN_LOG_LINES = 5

/**
 * Visible-window ceiling: the log panel never renders more than this many rows,
 * even on a very tall terminal. This bounds the height of the live region so a
 * huge terminal does not hold an enormous dynamic panel.
 */
const MAX_VISIBLE_LINES = 40

/**
 * Retained buffer depth (history / hard array cap). This is the scrollback the
 * user can page through with the keyboard — distinct from the visible window
 * height above. Trim-on-push keeps the newest lines; 1500 one-line strings is
 * trivial memory and gives real history to scroll without unbounded growth.
 */
const MAX_LOG_LINES = 1500

/**
 * Rows consumed by everything that is NOT a log line (info box chrome, its
 * margin, the log box border/title/padding, and safety slack). Subtracted from
 * the terminal height to derive the visible-window `cap` so the whole view
 * never exceeds the terminal and never triggers Ink redraw-thrash.
 */
const RESERVED_ROWS = 20

export interface DevUrls {
  local: string
  giftCard: string
  themeEditor: string
  preview: string
}

export interface ThemeDevUIProps {
  themeName: string
  urls: DevUrls
  abortController: AbortController
  devSessionOutput: DevSessionOutput
  /** Opens a shortcut URL. Mirrors the readline handler's debounced open. */
  onOpenURL: (key: 't' | 'p' | 'e' | 'g') => void
}

interface LogEntry {
  id: number
  line: string
}

function linkCell(label: string, url: string): TokenItem {
  return {link: {label, url}}
}

function statusColor(type: DevSessionStatus['type']): string {
  switch (type) {
    case 'error':
      return palette.accent
    case 'loading':
      return palette.subdued
    case 'success':
      return palette.role
  }
}

/**
 * Persistent `theme dev` Ink root. Unlike the one-shot `Panel`, this component
 * stays mounted for the life of the dev server: it never calls `useApp().exit()`
 * in a mount effect. The single exit path is the injected `AbortController`
 * (Ctrl-C via `useInput`, or an external abort) funnelled through
 * `useAbortSignal`, which is the only safe teardown under Ink 6 / React 19.
 *
 * Layout (top to bottom, single dynamic tree — no `<Static>`):
 *   1. The Charm info box (title, `●` status, links, shortcut footer) is pinned
 *      at the TOP inside a rounded border.
 *   2. A bounded, height-capped log panel renders BELOW it inside its own
 *      rounded border. Its VISIBLE window height is `cap` rows, derived from the
 *      terminal height (rows minus RESERVED_ROWS) clamped between MIN_LOG_LINES
 *      and MAX_VISIBLE_LINES, so the whole view is always bounded by the terminal.
 *
 * Two distinct concepts, deliberately kept separate:
 *   - RETAINED buffer (`logs`, capped at `MAX_LOG_LINES = 1500`): the scrollback
 *     history the user can page through.
 *   - VISIBLE window (`cap` rows): how many of those lines are on screen.
 *
 * In-app keyboard scrolling replaces terminal-native scrollback (a deliberate
 * tradeoff): `scrollOffset` is the number of lines the bottom of the window sits
 * ABOVE the live tail. `0` follows the live tail (new logs auto-scroll); `>0`
 * holds that many lines back (new logs do NOT jump the view to the bottom).
 * ↑/↓ scroll a line, PgUp/PgDn a page, End/`0` jump back to live.
 */
const ThemeDevUI: FunctionComponent<ThemeDevUIProps> = ({
  themeName,
  urls,
  abortController,
  devSessionOutput,
  onOpenURL,
}) => {
  const {isRawModeSupported: canUseShortcuts} = useStdin()
  const {stdout} = useStdout()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [status, setStatus] = useState<DevSessionStatus>({message: 'running', type: 'success'})
  const [scrollOffset, setScrollOffset] = useState(0)

  const {isAborted} = useAbortSignal(abortController.signal)

  useEffect(() => {
    let nextId = 0
    const append = (line: string) => {
      setLogs((previous) => {
        const grown = [...previous, {id: nextId++, line}]
        const next = grown.length > MAX_LOG_LINES ? grown.slice(-MAX_LOG_LINES) : grown
        // Actual length change: +1 while the buffer has room, 0 once saturated
        // (append adds 1, tail-trim drops 1). Never hardcode +1.
        const netDelta = next.length - previous.length

        // Sticky scroll: when held above the tail (offset > 0), grow the offset
        // by the net number of appended lines so the SAME absolute lines stay on
        // screen instead of sliding forward. When following (offset === 0), stay
        // pinned to the live tail. Uses only the render-scope `cap` closure.
        setScrollOffset((off) => {
          if (off === 0) return 0
          const heldMaxOffset = Math.max(0, next.length - cap)
          return Math.min(off + netDelta, heldMaxOffset)
        })

        return next
      })
    }

    const onLog = (text: string) => append(text)
    const onStatus = (next: DevSessionStatus) => setStatus(next)
    // Error fold: bold ⚠ glyph in error-pink so the line reads clearly as an
    // error and stands out from the col-2 request/sync grid (deliberately NOT
    // padded/aligned). Single space before the message; headline in error-pink,
    // optional subdued em-dash body. The composed line is a single row (no `\n`)
    // so the panel truncates cleanly.
    const glyph = paint(palette.status.error).bold('⚠')
    const onAlert = (alert: DevSessionAlert) => {
      const headline = paint(palette.status.error)(alert.headline)
      const body = alert.body ? paint(palette.subdued)(` — ${alert.body}`) : ''
      append(`${glyph} ${headline}${body}`)
    }
    const onError = (error: Error | string) => {
      const message = error instanceof Error ? (error.stack ?? error.message) : error
      const firstLine = String(message).split('\n')[0] ?? String(message)
      append(`${glyph} ${paint(palette.status.error)(firstLine)}`)
    }

    devSessionOutput.on('log', onLog)
    devSessionOutput.on('status', onStatus)
    devSessionOutput.on('alert', onAlert)
    devSessionOutput.on('session-error', onError)

    return () => {
      devSessionOutput.off('log', onLog)
      devSessionOutput.off('status', onStatus)
      devSessionOutput.off('alert', onAlert)
      devSessionOutput.off('session-error', onError)
    }
  }, [devSessionOutput])

  const cap = Math.max(MIN_LOG_LINES, Math.min(MAX_VISIBLE_LINES, (stdout?.rows ?? 24) - RESERVED_ROWS))
  const maxOffset = Math.max(0, logs.length - cap)
  const offset = Math.min(scrollOffset, maxOffset)
  const end = logs.length - offset
  const start = Math.max(0, end - cap)
  const visible = logs.slice(start, end)
  const following = offset === 0
  const page = Math.max(1, cap - 1)

  useInput(
    (input, key) => {
      handleCtrlC(input, key, () => abortController.abort())
      if (key.ctrl) return

      if (input === 't' || input === 'p' || input === 'e' || input === 'g') {
        onOpenURL(input)
        return
      }

      if (key.upArrow) {
        setScrollOffset((off) => Math.min(off + 1, maxOffset))
      } else if (key.downArrow) {
        setScrollOffset((off) => Math.max(0, off - 1))
      } else if (key.pageUp) {
        setScrollOffset((off) => Math.min(off + page, maxOffset))
      } else if (key.pageDown) {
        setScrollOffset((off) => Math.max(0, off - page))
      } else if (key.end || input === '0') {
        setScrollOffset(0)
      }
    },
    {isActive: Boolean(canUseShortcuts)},
  )

  const rows: Cell[][] = [
    ['Local', linkCell(urls.local, urls.local)],
    ['Editor', linkCell('Open in Theme Editor', urls.themeEditor)],
    ['Preview', linkCell('Share theme preview', urls.preview)],
    ['Gift cards', linkCell('Preview gift cards', urls.giftCard)],
  ]

  if (isAborted) return null

  return (
    <Box flexDirection="column">
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={palette.border}
        paddingX={2}
        paddingY={1}
        marginBottom={1}
      >
        <Text bold color={palette.header}>
          {`${themeName} · dev server`}
        </Text>
        <Box>
          <Text color={statusColor(status.type)}>● </Text>
          <Text color={palette.text}>{status.message}</Text>
        </Box>
        <StyledTable rows={rows} firstColumnSubdued />
        <Box marginTop={1}>
          <Text color={palette.subdued}>
            (t) localhost {'  '}(p) preview {'  '}(e) editor {'  '}(g) gift cards {'  '}· {'  '}↑↓/PgUp/PgDn scroll ·
            End live {'  '}· {'  '}Ctrl-C to stop
          </Text>
        </Box>
      </Box>

      <Box flexDirection="column" borderStyle="round" borderColor={palette.border} paddingX={2} paddingY={1}>
        <Box justifyContent="space-between">
          <Text bold color={palette.header}>
            logs
          </Text>
          {following ? (
            <Text color={palette.subdued}>live</Text>
          ) : (
            <Text color={palette.subdued}>{`↑ ${offset} older · End/0 = live`}</Text>
          )}
        </Box>
        {visible.length === 0 ? (
          <Text color={palette.subdued}>Waiting for activity…</Text>
        ) : (
          visible.map((entry) => (
            <Text key={entry.id} wrap="truncate-end">
              {entry.line}
            </Text>
          ))
        )}
      </Box>
    </Box>
  )
}

export {ThemeDevUI}
