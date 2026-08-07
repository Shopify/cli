import {useOnWheel} from './Mouse.js'
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

interface ConcurrentOutputContext {
  outputPrefix?: string
  stripAnsi?: boolean
}

const outputContextStore = new AsyncLocalStorage<ConcurrentOutputContext>()
const LOG_SCROLL_STEP = 3

interface ScrollableConcurrentOutputProps {
  chunks: Chunk[]
  formatPrefix: (prefix: string) => string
  lineVertical: string
  outputFilter?: (prefix: string) => boolean
  showTimestamps: boolean
}

const ScrollableConcurrentOutput: FunctionComponent<ScrollableConcurrentOutputProps> = ({
  chunks,
  formatPrefix,
  lineVertical,
  outputFilter,
  showTimestamps,
}) => {
  const viewportRef = useRef<DOMElement | null>(null)
  const previousOutputFilterRef = useRef(outputFilter)
  const [viewportHeight, setViewportHeight] = useState(1)
  const [scrollOffset, setScrollOffset] = useState(0)
  const [isFollowingOutput, setIsFollowingOutput] = useState(true)
  const outputLines = useMemo<OutputLine[]>(
    () =>
      chunks.flatMap((chunk) =>
        !outputFilter || outputFilter(chunk.prefix) ? chunk.lines.map((line) => ({chunk, line})) : [],
      ),
    [chunks, outputFilter],
  )
  const visibleLineCount = Math.max(1, viewportHeight - 2)
  const maximumScrollOffset = Math.max(0, outputLines.length - visibleLineCount)

  const updateViewportHeight = useCallback((node: DOMElement | null) => {
    viewportRef.current = node
    if (!node) return
    const measuredHeight = measureElement(node).height
    setViewportHeight((currentHeight) => (currentHeight === measuredHeight ? currentHeight : measuredHeight))
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

  useInput(
    (_input, key) => {
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

  const visibleOutputLines = outputLines.slice(scrollOffset, scrollOffset + visibleLineCount)

  return (
    <Box
      ref={updateViewportHeight}
      borderStyle="round"
      flexDirection="row"
      flexGrow={1}
      minHeight={3}
      overflowY="hidden"
      width="100%"
    >
      <Box flexDirection="column" flexGrow={1} width={0} overflowY="hidden">
        {visibleOutputLines.map(({chunk, line}, index) => (
          <Text key={`${scrollOffset + index}-${chunk.timestamp}`} wrap="truncate">
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
        ))}
      </Box>
      {outputLines.length > visibleLineCount ? (
        <Scrollbar
          containerHeight={visibleLineCount}
          visibleListSectionLength={visibleLineCount}
          fullListLength={outputLines.length}
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
}) => {
  const [processOutput, setProcessOutput] = useState<Chunk[]>([])
  const [completionResult, setCompletionResult] = useState<{error?: Error} | null>(null)
  const onOutputPrefixRef = useRef(onOutputPrefix)
  onOutputPrefixRef.current = onOutputPrefix
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

  const addPrefix = (prefix: string, prefixes: string[]) => {
    const index = prefixes.indexOf(prefix)
    if (index !== -1) {
      return index
    }
    prefixes.push(prefix)
    return prefixes.length - 1
  }

  const lineColor = useCallback(
    (index: number) => {
      const colorIndex = index % concurrentColors.length
      return concurrentColors[colorIndex]
    },
    [concurrentColors],
  )

  const writableStream = useCallback(
    (process: OutputProcess, prefixes: string[]) => {
      return new Writable({
        write(chunk, _encoding, next) {
          const context = outputContextStore.getStore()
          const prefix = context?.outputPrefix ?? process.prefix
          const shouldStripAnsi = context?.stripAnsi ?? true
          const log = chunk.toString('utf8').replace(/(\n)$/, '')

          const index = addPrefix(prefix, prefixes)

          const outputChunk = {
            color: lineColor(index),
            prefix,
            lines: shouldStripAnsi ? stripAnsi(log).split(/\n/) : log.split(/\n/),
            timestamp: currentTime(),
          }

          onOutputPrefixRef.current?.(prefix)
          setProcessOutput((previousProcessOutput) => [...previousProcessOutput, outputChunk])
          next()
        },
      })
    },
    [lineColor],
  )

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
      const prefixes: string[] = []

      try {
        await Promise.all(
          processes.map(async (process) => {
            const stdout = writableStream(process, prefixes)
            const stderr = writableStream(process, prefixes)
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
        showTimestamps={showTimestamps}
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
