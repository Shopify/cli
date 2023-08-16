import {OutputProcess} from '../../../../public/node/output.js'
import {AbortController} from '../../../../public/node/abort.js'
import {treeKill} from '../../../../public/node/tree-kill.js'
import {handleCtrlC} from '../../ui.js'
import {addOrUpdateConcurrentUIEventOutput} from '../../demo-recorder.js'
import useAbortSignal from '../hooks/use-abort-signal.js'
import React, {FunctionComponent, useCallback, useEffect, useMemo, useState} from 'react'
import {Box, Key, Static, Text, useInput, TextProps, useStdin, useApp} from 'ink'
import stripAnsi from 'strip-ansi'
import figures from 'figures'
import {Writable} from 'stream'

export type WritableStream = (process: OutputProcess, index: number) => Writable

export interface Footer {
  shortcuts: Shortcut[]
  subTitle?: string
}

export interface FooterContext {
  footer?: Footer
  updateShortcut: (prevShortcut: Shortcut, newShortcut: Shortcut) => void
  updateSubTitle: (subTitle: string) => void
}

interface Shortcut {
  key: string
  action: string
  syncer?: (footerContext: FooterContext, abortController: AbortController) => void
  state?: {
    [key: string]: unknown
  }
}
export interface ConcurrentOutputProps {
  processes: OutputProcess[]
  abortController: AbortController
  showTimestamps?: boolean
  onInput?: (input: string, key: Key, exit: () => void) => void
  onInputAsync?: (input: string, key: Key, exit: () => void, footerContext: FooterContext) => Promise<void>
  footer?: Footer
  // If set, the component is not automatically unmounted once the processes have all finished
  keepRunningAfterProcessesResolve?: boolean
}
interface Chunk {
  color: TextProps['color']
  prefix: string
  lines: string[]
}
enum ConcurrentOutputState {
  Running = 'running',
  Stopped = 'stopped',
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
  abortController,
  showTimestamps = true,
  onInput,
  onInputAsync,
  footer,
  keepRunningAfterProcessesResolve,
}) => {
  const [processOutput, setProcessOutput] = useState<Chunk[]>([])
  const {exit: unmountInk} = useApp()
  const prefixColumnSize = Math.max(...processes.map((process) => process.prefix.length))
  const {isRawModeSupported} = useStdin()
  const [state, setState] = useState<ConcurrentOutputState>(ConcurrentOutputState.Running)
  const [footerContent, setFooterContent] = useState<Footer | undefined>(footer)
  const concurrentColors: TextProps['color'][] = useMemo(() => ['yellow', 'cyan', 'magenta', 'green', 'blue'], [])
  const lineColor = useCallback(
    (index: number) => {
      const colorIndex = index < concurrentColors.length ? index : index % concurrentColors.length
      return concurrentColors[colorIndex]!
    },
    [concurrentColors],
  )
  const writableStream = useCallback(
    (process: OutputProcess, index: number) => {
      return new Writable({
        write(chunk, _encoding, next) {
          const lines = stripAnsi(chunk.toString('utf8').replace(/(\n)$/, '')).split(/\n/)
          addOrUpdateConcurrentUIEventOutput({prefix: process.prefix, index, output: lines.join('\n')}, {footer})
          setProcessOutput((previousProcessOutput) => [
            ...previousProcessOutput,
            {
              color: lineColor(index),
              prefix: process.prefix,
              lines,
            },
          ])
          next()
        },
      })
    },
    [footer, lineColor],
  )
  const {isAborted} = useAbortSignal(abortController.signal)
  const useShortcuts = isRawModeSupported && state === ConcurrentOutputState.Running && !isAborted

  const updateShortcut = (prevShortcut: Shortcut, newShortcut: Shortcut) => {
    if (!footerContent) return
    const newFooterContent = {...footerContent}

    newFooterContent.shortcuts.map((short) => {
      if (short.key === prevShortcut.key) {
        short.action = newShortcut.action
        short.key = newShortcut.key
        short.state = newShortcut.state
      }
    })
    setFooterContent(newFooterContent)
  }

  const updateSubTitle = (subTitle: string) => {
    if (!footerContent) return

    setFooterContent({...footerContent, subTitle})
  }

  const runShortcutSyncs = () => {
    footerContent?.shortcuts?.forEach((shortcut) => {
      if (shortcut.syncer) shortcut.syncer({footer: footerContent, updateShortcut, updateSubTitle}, abortController)
    })
  }

  useInput(
    (input, key) => {
      const exit = abortController ? () => abortController.abort() : () => treeKill('SIGINT')

      handleCtrlC(input, key, exit)

      const triggerOnInput = async () => {
        if (onInput) {
          onInput(input, key, exit)
        } else if (onInputAsync) {
          await onInputAsync(input, key, exit, {footer: footerContent, updateShortcut, updateSubTitle})
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      triggerOnInput()
    },
    {isActive: (typeof onInput !== 'undefined' || typeof onInputAsync !== 'undefined') && useShortcuts},
  )

  useEffect(() => {
    runShortcutSyncs()
  }, [])

  useEffect(() => {
    ;(() => {
      return Promise.all(
        processes.map(async (process, index) => {
          const stdout = writableStream(process, index)
          const stderr = writableStream(process, index)
          await process.action(stdout, stderr, abortController.signal)
        }),
      )
    })()
      .then(() => {
        if (!keepRunningAfterProcessesResolve) {
          setState(ConcurrentOutputState.Stopped)
          unmountInk()
        }
      })
      .catch((error) => {
        setState(ConcurrentOutputState.Stopped)
        unmountInk(error)
      })
  }, [abortController, processes, writableStream, unmountInk, keepRunningAfterProcessesResolve])
  const {lineVertical} = figures
  return (
    <>
      <Static items={processOutput}>
        {(chunk, index) => {
          const prefixBuffer = ' '.repeat(prefixColumnSize - chunk.prefix.length)
          return (
            <Box flexDirection="column" key={index}>
              {chunk.lines.map((line, index) => (
                <Box key={index} flexDirection="row">
                  <Text color={chunk.color}>
                    {showTimestamps ? (
                      <Text>
                        {currentTime()} {lineVertical}{' '}
                      </Text>
                    ) : null}
                    <Text>
                      {chunk.prefix}
                      {prefixBuffer} {lineVertical} {line}
                    </Text>
                  </Text>
                </Box>
              ))}
            </Box>
          )
        }}
      </Static>
      {footerContent && !isAborted ? (
        <Box
          marginY={1}
          paddingTop={1}
          flexDirection="column"
          flexGrow={1}
          borderStyle="single"
          borderBottom={false}
          borderLeft={false}
          borderRight={false}
          borderTop
        >
          {useShortcuts ? (
            <Box flexDirection="column">
              {footerContent.shortcuts.map((shortcut, index) => (
                <Text key={index}>
                  {figures.pointerSmall} Press <Text bold>{shortcut.key}</Text> {figures.lineVertical} {shortcut.action}
                </Text>
              ))}
            </Box>
          ) : null}
          {footerContent.subTitle ? (
            <Box marginTop={useShortcuts ? 1 : 0}>
              <Text>{footerContent.subTitle}</Text>
            </Box>
          ) : null}
        </Box>
      ) : null}
    </>
  )
}
export {ConcurrentOutput}
