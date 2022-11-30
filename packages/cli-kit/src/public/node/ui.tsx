import ConcurrentOutput from '../../private/node/ui/components/ConcurrentOutput.js'
import {OutputProcess} from '../../output.js'
import {render, renderOnce} from '../../private/node/ui.js'
import {Fatal} from '../../error.js'
import {alert} from '../../private/node/ui/alert.js'
import {fatalError} from '../../private/node/ui/error.js'
import {AlertProps} from '../../private/node/ui/components/Alert.js'
import React, { useEffect, useState } from 'react'
import {AbortController} from 'abort-controller'
import type {Writable, Readable} from 'node:stream'
import FullScreen from '../../private/node/ui/components/FullScreen.js'
import { Box, Spacer, useInput, useStdout } from 'ink'
import {Text} from "ink";

interface RenderConcurrentOptions {
  processes: OutputProcess[]
  abortController?: AbortController
  showTimestamps?: boolean
}

/**
 * Renders output from concurrent processes to the terminal with {@link ConcurrentOutput}.
 */
export async function renderConcurrent({processes, abortController, showTimestamps = true}: RenderConcurrentOptions) {
  const {waitUntilExit} = render(
    <ConcurrentOutput
      processes={processes}
      abortController={abortController ?? new AbortController()}
      showTimestamps={showTimestamps}
    />,
  )

  return waitUntilExit()
}

type RenderAlertOptions = Omit<AlertProps, 'type'>

/**
 * Renders an information banner to the console.
 *
 * Basic:
 *
 * ```
 * ╭─ info ───────────────────────────────────────────────────╮
 * │                                                          │
 * │  Body                                                    │
 * │                                                          │
 * ╰──────────────────────────────────────────────────────────╯
 * ```
 *
 * Complete:
 * ```
 * ╭─ info ───────────────────────────────────────────────────╮
 * │                                                          │
 * │  Title                                                   │
 * │                                                          │
 * │  Body                                                    │
 * │                                                          │
 * │  Next steps                                              │
 * │    • Run `cd santorini-goods`                            │
 * │    • To preview your project, run `npm app dev`          │
 * │    • To add extensions, run `npm generate extension`     │
 * │                                                          │
 * │  Reference                                               │
 * │    • Run `npm shopify help`                              │
 * │    • Press 'return' to open the dev docs:                │
 * │      https://shopify.dev                                 │
 * │                                                          │
 * │  Link: https://shopify.com                               │
 * │                                                          │
 * ╰──────────────────────────────────────────────────────────╯
 * ```
 */
export function renderInfo(options: RenderAlertOptions) {
  alert({...options, type: 'info'})
}

interface RenderOutputWithFooterMenu {
  stdout: string,
  keyPressCallback: (key: string) => void,
  menu: {label: string, key: string}[]
}

function OutputWithFooter(options: RenderOutputWithFooterMenu) {
  const [date, setDate] = useState(new Date())
  const {stdout} = useStdout()
  const width = stdout!.columns
  const fillSpaces = (width - options.menu.map((option) => option.key.length + option.label.length).reduce((a, b) => a + b) - options.menu.length * 5)
  useInput((input, key) => {
    options.keyPressCallback(key)
  })

  useEffect(() => {
    setInterval(() => {
      setDate(new Date())
    }, 1000)
  }, [])
  return <FullScreen>
    <Box flexDirection='column' width="100%">
      <Box flexGrow={1}>
        <Text>{`${options.stdout}: ${date.toString()}`}</Text>
      </Box>
      <Box flexDirection='column'>
        <Box>
          {options.menu.map((menuOption) => {
            return <Box marginRight={5}>
                <Text>{menuOption.key}</Text>
                <Text inverse color={"cyan"}>{menuOption.label}</Text>
              </Box>
          })}
          <Box>
            <Text backgroundColor="cyan">{" ".repeat(fillSpaces)}</Text>
          </Box>
        </Box>
      </Box>
    </Box>
  </FullScreen>
}

export function renderOutputWithFooterMenu(options: RenderOutputWithFooterMenu) {
  render(
    <OutputWithFooter {...options}/>
  )
}

/**
 * Renders a success banner to the console.
 *
 * Basic:
 *
 * ```
 * ╭─ success ────────────────────────────────────────────────╮
 * │                                                          │
 * │  Title                                                   │
 * │                                                          │
 * ╰──────────────────────────────────────────────────────────╯
 * ```
 *
 * Complete:
 * ```
 * ╭─ success ────────────────────────────────────────────────╮
 * │                                                          │
 * │  Title                                                   │
 * │                                                          │
 * │  Body                                                    │
 * │                                                          │
 * │  Next steps                                              │
 * │    • Run `cd santorini-goods`                              │
 * │    • To preview your project, run `npm app dev`            │
 * │    • To add extensions, run `npm generate extension`       │
 * │                                                          │
 * │  Reference                                               │
 * │    • Run `npm shopify help`                                │
 * │    • Press 'return' to open the dev docs:                │
 * │      https://shopify.dev                                 │
 * │                                                          │
 * │  Link: https://shopify.com                               │
 * │                                                          │
 * ╰──────────────────────────────────────────────────────────╯
 * ```
 */
export function renderSuccess(options: RenderAlertOptions) {
  alert({...options, type: 'success'})
}

/**
 * Renders a warning banner to the console.
 *
 * Basic:
 *
 * ```
 * ╭─ warning ────────────────────────────────────────────────╮
 * │                                                          │
 * │  Title                                                   │
 * │                                                          │
 * ╰──────────────────────────────────────────────────────────╯
 * ```
 *
 * Complete:
 * ```
 * ╭─ warning ────────────────────────────────────────────────╮
 * │                                                          │
 * │  Title                                                   │
 * │                                                          │
 * │  Body                                                    │
 * │                                                          │
 * │  Next steps                                              │
 * │    • Run `cd santorini-goods`                            │
 * │    • To preview your project, run `npm app dev`          │
 * │    • To add extensions, run `npm generate extension`     │
 * │                                                          │
 * │  Reference                                               │
 * │    • Run `npm shopify help`                              │
 * │    • Press 'return' to open the dev docs:                │
 * │      https://shopify.dev                                 │
 * │                                                          │
 * │  Link: https://shopify.com                               │
 * │                                                          │
 * ╰──────────────────────────────────────────────────────────╯
 * ```
 */
export function renderWarning(options: RenderAlertOptions) {
  alert({...options, type: 'warning'})
}

/**
 * Renders a Fatal error to the console inside a banner.
 *
 * ```
 * ╭─ error ──────────────────────────────────────────────────╮
 * │                                                          │
 * │  Couldn't connect to the Shopify Partner Dashboard.      │
 * │                                                          │
 * │  Check your internet connection and try again.           │
 * │                                                          │
 * ╰──────────────────────────────────────────────────────────╯
 * ```
 */
export function renderFatalError(error: Fatal) {
  fatalError(error)
}
