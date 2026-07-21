import {useOnPress, useOnWheel} from './Mouse.js'
import {Scrollbar} from './Scrollbar.js'
import {OutputProcess} from '../../../../public/node/output.js'
import {AbortSignal} from '../../../../public/node/abort.js'
import {useComplete} from '../../ui.js'
import React, {FunctionComponent, useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {Box, DOMElement, measureElement, Static, Text, TextProps, useInput} from 'ink'
import figures from 'figures'
import stripAnsi from 'strip-ansi'

import {Writable} from 'stream'
import {AsyncLocalStorage} from 'node:async_hooks'

export interface ConcurrentOutputProps {
  processes: OutputProcess[]
  prefixColumnSize?: number
  abortSignal: AbortSignal
  showTimestamps?: boolean
  keepRunningAfterProcessesResolve?: boolean
  useAlternativeColorPalette?: boolean
  /** Renders output in a bounded viewport with keyboard and mouse-wheel scrolling. */
  scrollable?: boolean
  /** Filters both existing and future output by its displayed prefix. */
  outputFilter?: (prefix: string) => boolean
  /** Called when output is received, including output with a contextual prefix. */
  onOutputPrefix?: (prefix: string) => void
  /** Called with every output chunk after ANSI control sequences are normalized for display. */
  onOutput?: (chunk: ConcurrentOutputChunk) => void
  /** Adds this output once after the first click or drag inside the scrollable output viewport. */
  mouseInteractionHint?: {
    message: string
    prefix: string
  }
}

export interface ConcurrentOutputChunk {
  lines: string[]
  prefix: string
  timestamp: string
}

interface Chunk {
  color: TextProps['color']
  prefix: string
  lines: string[]
  timestamp: string
}

interface OutputLine {
  chunk: Chunk
  line: string
}

interface OutputRow extends OutputLine {
  isContinuation: boolean
}

function addLeadingZero(number: number) {
  if (number < 10) {
    return `0${number}`
  } else {
    return number.toString()
  }
}

function currentTime() {
  const currentDateTime = new Date()
  const hours = addLeadingZero(currentDateTime.getHours())
  const minutes = addLeadingZero(currentDateTime.getMinutes())
  const seconds = addLeadingZero(currentDateTime.getSeconds())
  return `${hours}:${minutes}:${seconds}`
}

function addPrefix(prefix: string, prefixes: string[]) {
  const index = prefixes.indexOf(prefix)
  if (index !== -1) return index

  prefixes.push(prefix)
  return prefixes.length - 1
}

interface ConcurrentOutputContext {
  outputPrefix?: string
  stripAnsi?: boolean
}

const outputContextStore = new AsyncLocalStorage<ConcurrentOutputContext>()
const LOG_SCROLL_STEP = 3
const VIEWPORT_BORDER_WIDTH = 2
const SCROLLBAR_WIDTH = 1
const COLUMN_SEPARATOR_WIDTH = 3
const TIMESTAMP_WIDTH = '00:00:00'.length
const ESCAPE_CHARACTER = String.fromCharCode(27)
const BELL_CHARACTER = String.fromCharCode(7)
const ANSI_SEQUENCE_PATTERN = new RegExp(
  `${ESCAPE_CHARACTER}(?:\\][^${BELL_CHARACTER}]*(?:${BELL_CHARACTER}|${ESCAPE_CHARACTER}\\\\)|\\[[0-?]*[ -/]*[@-~])`,
  'gu',
)
const SGR_SEQUENCE_PATTERN = new RegExp(`^${ESCAPE_CHARACTER}\\[[0-?]*m$`, 'u')
const EMOJI_PATTERN = /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20E3/u

interface SegmenterConstructor {
  new (
    locales?: string | string[],
    options?: {granularity: 'grapheme'},
  ): {
    segment: (input: string) => Iterable<{segment: string}>
  }
}

// The supported Node versions provide Intl.Segmenter, but the project's current TypeScript lib does not declare it.
const Segmenter = (Intl as unknown as {Segmenter: SegmenterConstructor}).Segmenter
const graphemeSegmenter = new Segmenter(undefined, {granularity: 'grapheme'})

interface TerminalToken {
  isAnsi: boolean
  value: string
  width: number
}

function isFullwidthCodePoint(codePoint: number): boolean {
  return (
    codePoint >= 0x1100 &&
    (codePoint <= 0x115f ||
      codePoint === 0x2329 ||
      codePoint === 0x232a ||
      (codePoint >= 0x2e80 && codePoint <= 0x303e) ||
      (codePoint >= 0x3040 && codePoint <= 0xa4cf) ||
      (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
      (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
      (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
      (codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
      (codePoint >= 0xff00 && codePoint <= 0xff60) ||
      (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
      (codePoint >= 0x1b000 && codePoint <= 0x1b2ff) ||
      (codePoint >= 0x1f200 && codePoint <= 0x1f251) ||
      (codePoint >= 0x20000 && codePoint <= 0x3fffd))
  )
}

function graphemeWidth(grapheme: string): number {
  const codePoint = grapheme.codePointAt(0)
  if (codePoint === undefined || codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f)) return 0
  if (EMOJI_PATTERN.test(grapheme) || isFullwidthCodePoint(codePoint)) return 2
  return 1
}

function terminalTokens(input: string): TerminalToken[] {
  const tokens: TerminalToken[] = []
  let plainTextStart = 0

  const appendPlainText = (plainText: string) => {
    for (const {segment} of graphemeSegmenter.segment(plainText)) {
      tokens.push({isAnsi: false, value: segment, width: graphemeWidth(segment)})
    }
  }

  for (const match of input.matchAll(ANSI_SEQUENCE_PATTERN)) {
    appendPlainText(input.slice(plainTextStart, match.index))
    tokens.push({isAnsi: true, value: match[0], width: 0})
    plainTextStart = match.index + match[0].length
  }
  appendPlainText(input.slice(plainTextStart))

  return tokens
}

function wrapTerminalLine(line: string, maximumWidth: number): string[] {
  const width = Math.max(1, maximumWidth)
  const rows: string[] = []
  let activeSgrSequences = ''
  let currentRow = ''
  let currentWidth = 0

  for (const token of terminalTokens(line)) {
    if (token.isAnsi) {
      currentRow += token.value
      if (SGR_SEQUENCE_PATTERN.test(token.value)) activeSgrSequences += token.value
      continue
    }

    if (currentWidth > 0 && currentWidth + token.width > width) {
      rows.push(activeSgrSequences ? `${currentRow}\u001B[0m` : currentRow)
      currentRow = activeSgrSequences
      currentWidth = 0
    }

    currentRow += token.value
    currentWidth += token.width
  }

  rows.push(currentRow)
  return rows
}

function wrapOutputLines(outputLines: OutputLine[], messageWidth: number): OutputRow[] {
  return outputLines.flatMap(({chunk, line}) =>
    wrapTerminalLine(line, messageWidth).map((wrappedLine, index) => ({
      chunk,
      line: wrappedLine,
      isContinuation: index > 0,
    })),
  )
}

interface ScrollableConcurrentOutputProps {
  chunks: Chunk[]
  formatPrefix: (prefix: string) => string
  lineVertical: string
  outputFilter?: (prefix: string) => boolean
  prefixColumnSize: number
  showTimestamps: boolean
  onMouseInteraction?: () => void
}

const ScrollableConcurrentOutput: FunctionComponent<ScrollableConcurrentOutputProps> = ({
  chunks,
  formatPrefix,
  lineVertical,
  outputFilter,
  prefixColumnSize,
  showTimestamps,
  onMouseInteraction,
}) => {
  const viewportRef = useRef<DOMElement | null>(null)
  const previousOutputFilterRef = useRef(outputFilter)
  const [viewportDimensions, setViewportDimensions] = useState<{height: number; width: number}>()
  const [scrollOffset, setScrollOffset] = useState(0)
  const [isFollowingOutput, setIsFollowingOutput] = useState(true)
  const outputLines = useMemo<OutputLine[]>(
    () =>
      chunks.flatMap((chunk) =>
        !outputFilter || outputFilter(chunk.prefix) ? chunk.lines.map((line) => ({chunk, line})) : [],
      ),
    [chunks, outputFilter],
  )
  const visibleLineCount = Math.max(1, (viewportDimensions?.height ?? 1) - VIEWPORT_BORDER_WIDTH)
  const metadataWidth =
    prefixColumnSize + COLUMN_SEPARATOR_WIDTH + (showTimestamps ? TIMESTAMP_WIDTH + COLUMN_SEPARATOR_WIDTH : 0)
  const rowsWithoutScrollbar = useMemo(
    () =>
      viewportDimensions
        ? wrapOutputLines(outputLines, viewportDimensions.width - VIEWPORT_BORDER_WIDTH - metadataWidth)
        : outputLines.map(({chunk, line}) => ({chunk, line, isContinuation: false})),
    [metadataWidth, outputLines, viewportDimensions],
  )
  const outputRows = useMemo(
    () =>
      viewportDimensions && rowsWithoutScrollbar.length > visibleLineCount
        ? wrapOutputLines(
            outputLines,
            viewportDimensions.width - VIEWPORT_BORDER_WIDTH - metadataWidth - SCROLLBAR_WIDTH,
          )
        : rowsWithoutScrollbar,
    [metadataWidth, outputLines, rowsWithoutScrollbar, viewportDimensions, visibleLineCount],
  )
  const maximumScrollOffset = Math.max(0, outputRows.length - visibleLineCount)

  const updateViewportDimensions = useCallback((node: DOMElement | null) => {
    viewportRef.current = node
    if (!node) return
    const measuredDimensions = measureElement(node)
    setViewportDimensions((currentDimensions) =>
      currentDimensions?.height === measuredDimensions.height && currentDimensions.width === measuredDimensions.width
        ? currentDimensions
        : measuredDimensions,
    )
  }, [])

  const scrollBy = useCallback(
    (lineCount: number) => {
      setScrollOffset((currentOffset) => {
        const nextOffset = Math.max(0, Math.min(maximumScrollOffset, currentOffset + lineCount))
        setIsFollowingOutput(nextOffset === maximumScrollOffset)
        return nextOffset
      })
    },
    [maximumScrollOffset],
  )

  useOnWheel(viewportRef, (event) => {
    if (event.button === 'wheel-up') scrollBy(-LOG_SCROLL_STEP)
    if (event.button === 'wheel-down') scrollBy(LOG_SCROLL_STEP)
  })
  // A drag that attempts to select text does not produce a click, but it always begins
  // with a press. Handling the press covers both clicks and drags in click-only mouse mode.
  useOnPress(viewportRef, onMouseInteraction)

  useInput(
    (_input, key) => {
      if (key.upArrow) scrollBy(-1)
      if (key.downArrow) scrollBy(1)
      if (key.pageUp) scrollBy(-visibleLineCount)
      if (key.pageDown) scrollBy(visibleLineCount)
    },
    {isActive: true},
  )

  useEffect(() => {
    const filterChanged = previousOutputFilterRef.current !== outputFilter
    previousOutputFilterRef.current = outputFilter

    if (filterChanged) {
      setScrollOffset(0)
      setIsFollowingOutput(false)
    } else {
      setScrollOffset((currentOffset) =>
        isFollowingOutput ? maximumScrollOffset : Math.min(currentOffset, maximumScrollOffset),
      )
    }
  }, [isFollowingOutput, maximumScrollOffset, outputFilter])

  const visibleOutputRows = outputRows.slice(scrollOffset, scrollOffset + visibleLineCount)

  return (
    <Box
      ref={updateViewportDimensions}
      borderStyle="round"
      flexDirection="row"
      flexGrow={1}
      minHeight={3}
      overflowY="hidden"
      width="100%"
    >
      <Box flexDirection="column" flexGrow={1} width={0} overflowY="hidden">
        {visibleOutputRows.map(({chunk, line, isContinuation}, index) => (
          <Text key={`${scrollOffset + index}-${chunk.timestamp}`} wrap="truncate">
            {showTimestamps ? (
              <Text>
                {isContinuation ? ' '.repeat(chunk.timestamp.length) : chunk.timestamp} {lineVertical}{' '}
              </Text>
            ) : null}
            <Text color={chunk.color}>
              {isContinuation ? ' '.repeat(prefixColumnSize) : formatPrefix(chunk.prefix)}
            </Text>
            <Text>
              {' '}
              {lineVertical} {line}
            </Text>
          </Text>
        ))}
      </Box>
      {outputRows.length > visibleLineCount ? (
        <Scrollbar
          containerHeight={visibleLineCount}
          visibleListSectionLength={visibleLineCount}
          fullListLength={outputRows.length}
          visibleFromIndex={scrollOffset}
          noColor
        />
      ) : null}
    </Box>
  )
}

function useConcurrentOutputContext<T>(context: ConcurrentOutputContext, callback: () => T): T {
  return outputContextStore.run(context, callback)
}

/**
 * Renders output from concurrent processes to the terminal.
 * Output will be divided in a three column layout
 * with the left column containing the timestamp,
 * the right column containing the output,
 * and the middle column containing the process prefix.
 * Every process will be rendered with a different color, up to 4 colors.
 *
 * For example running `shopify app dev`:
 *
 * ```shell
 * 2022-10-10 13:11:03 | backend    | npm
 * 2022-10-10 13:11:03 | backend    |  WARN ignoring workspace config at ...
 * 2022-10-10 13:11:03 | backend    |
 * 2022-10-10 13:11:03 | backend    |
 * 2022-10-10 13:11:03 | backend    | > shopify-app-template-node@0.1.0 dev
 * 2022-10-10 13:11:03 | backend    | > cross-env NODE_ENV=development nodemon backend/index.js --watch ./backend
 * 2022-10-10 13:11:03 | backend    |
 * 2022-10-10 13:11:03 | backend    |
 * 2022-10-10 13:11:03 | frontend   |
 * 2022-10-10 13:11:03 | frontend   | > starter-react-frontend-app@0.1.0 dev
 * 2022-10-10 13:11:03 | frontend   | > cross-env NODE_ENV=development node vite-server.js
 * 2022-10-10 13:11:03 | frontend   |
 * 2022-10-10 13:11:03 | frontend   |
 * 2022-10-10 13:11:03 | backend    |
 * 2022-10-10 13:11:03 | backend    | [nodemon] to restart at any time, enter `rs`
 * 2022-10-10 13:11:03 | backend    | [nodemon] watching path(s): backend/
 * 2022-10-10 13:11:03 | backend    | [nodemon] watching extensions: js,mjs,json
 * 2022-10-10 13:11:03 | backend    | [nodemon] starting `node backend/index.js`
 * 2022-10-10 13:11:03 | backend    |
 *
 * ```
 */
const ConcurrentOutput: FunctionComponent<ConcurrentOutputProps> = ({
  processes,
  prefixColumnSize,
  abortSignal,
  showTimestamps = true,
  keepRunningAfterProcessesResolve = false,
  useAlternativeColorPalette = false,
  scrollable = false,
  outputFilter,
  onOutputPrefix,
  onOutput,
  mouseInteractionHint,
}) => {
  const [processOutput, setProcessOutput] = useState<Chunk[]>([])
  const [completionResult, setCompletionResult] = useState<{error?: Error} | null>(null)
  const onOutputPrefixRef = useRef(onOutputPrefix)
  onOutputPrefixRef.current = onOutputPrefix
  const onOutputRef = useRef(onOutput)
  onOutputRef.current = onOutput
  const prefixesRef = useRef<string[]>([])
  const mouseInteractionHintShownRef = useRef(false)
  const complete = useComplete()
  const concurrentColors: TextProps['color'][] = useMemo(
    () =>
      useAlternativeColorPalette
        ? ['#b994c3', '#e69e19', '#d17a73', 'cyan', 'magenta', 'blue']
        : ['yellow', 'cyan', 'magenta', 'green', 'blue'],
    [useAlternativeColorPalette],
  )

  const calculatedPrefixColumnSize = useMemo(() => {
    const maxColumnSize = 25

    // If the prefixColumnSize is not provided, we calculate it based on the longest process prefix
    const columnSize =
      prefixColumnSize ??
      processes.reduce((maxPrefixLength, process) => Math.max(maxPrefixLength, process.prefix.length), 0)

    // Apply overall limit to the prefix column size
    return Math.min(columnSize, maxColumnSize)
  }, [processes, prefixColumnSize])

  const lineColor = useCallback(
    (index: number) => {
      const colorIndex = index % concurrentColors.length
      return concurrentColors[colorIndex]
    },
    [concurrentColors],
  )

  const appendOutput = useCallback(
    (lines: string[], prefix: string) => {
      const prefixIndex = addPrefix(prefix, prefixesRef.current)
      const outputChunk = {
        color: lineColor(prefixIndex),
        prefix,
        lines,
        timestamp: currentTime(),
      }

      onOutputPrefixRef.current?.(prefix)
      onOutputRef.current?.({lines: outputChunk.lines, prefix, timestamp: outputChunk.timestamp})
      setProcessOutput((previousProcessOutput) => [...previousProcessOutput, outputChunk])
    },
    [lineColor],
  )

  const writableStream = useCallback(
    (process: OutputProcess) => {
      return new Writable({
        write(chunk, _encoding, next) {
          const context = outputContextStore.getStore()
          const prefix = context?.outputPrefix ?? process.prefix
          const shouldStripAnsi = context?.stripAnsi ?? true
          const log = chunk.toString('utf8').replace(/(\n)$/, '')

          appendOutput(shouldStripAnsi ? stripAnsi(log).split(/\n/) : log.split(/\n/), prefix)
          next()
        },
      })
    },
    [appendOutput],
  )

  const showMouseInteractionHint = useCallback(() => {
    if (!mouseInteractionHint || mouseInteractionHintShownRef.current) return

    mouseInteractionHintShownRef.current = true
    appendOutput([mouseInteractionHint.message], mouseInteractionHint.prefix)
  }, [appendOutput, mouseInteractionHint])

  const formatPrefix = useCallback(
    (prefix: string) => {
      // Truncate prefix if needed
      if (prefix.length > calculatedPrefixColumnSize) {
        return prefix.substring(0, calculatedPrefixColumnSize)
      }

      return `${' '.repeat(calculatedPrefixColumnSize - prefix.length)}${prefix}`
    },
    [calculatedPrefixColumnSize],
  )

  useEffect(() => {
    const runProcesses = async () => {
      try {
        await Promise.all(
          processes.map(async (process) => {
            const stdout = writableStream(process)
            const stderr = writableStream(process)
            await process.action(stdout, stderr, abortSignal)
          }),
        )
        if (!keepRunningAfterProcessesResolve) {
          setCompletionResult({})
        }
        // eslint-disable-next-line no-catch-all/no-catch-all
      } catch (error: unknown) {
        if (!keepRunningAfterProcessesResolve) {
          setCompletionResult({error: error as Error})
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    runProcesses()
  }, [abortSignal, processes, writableStream, keepRunningAfterProcessesResolve])

  useEffect(() => {
    if (completionResult !== null) {
      complete(completionResult.error)
    }
  }, [completionResult, complete])

  const {lineVertical} = figures

  const renderChunk = (chunk: Chunk, index: number) => (
    <Box flexDirection="column" key={index}>
      {chunk.lines.map((line, index) => (
        <Box key={index} flexDirection="row">
          <Text>
            {showTimestamps ? (
              <Text>
                {chunk.timestamp} {lineVertical}{' '}
              </Text>
            ) : null}
            <Text color={chunk.color}>{formatPrefix(chunk.prefix)}</Text>
            <Text>
              {' '}
              {lineVertical} {line}
            </Text>
          </Text>
        </Box>
      ))}
    </Box>
  )

  if (scrollable) {
    return (
      <ScrollableConcurrentOutput
        chunks={processOutput}
        formatPrefix={formatPrefix}
        lineVertical={lineVertical}
        outputFilter={outputFilter}
        prefixColumnSize={calculatedPrefixColumnSize}
        showTimestamps={showTimestamps}
        onMouseInteraction={mouseInteractionHint ? showMouseInteractionHint : undefined}
      />
    )
  }

  if (outputFilter) {
    // Ink's Static output is immutable once written, so filterable output must remain in the live render tree.
    return <Box flexDirection="column">{processOutput.filter(({prefix}) => outputFilter(prefix)).map(renderChunk)}</Box>
  }

  return <Static items={processOutput}>{renderChunk}</Static>
}
export {ConcurrentOutput, ConcurrentOutputContext, useConcurrentOutputContext}
