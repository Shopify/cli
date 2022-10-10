import ConcurrentOutput, {WritableStream} from '../../private/node/components/ConcurrentOutput.js'
import {OutputProcess} from '../../output.js'
import {render} from '../../private/node/ui.js'
import {Fatal} from '../../error.js'
import {AlertProps, alert} from '../../private/node/ui/alert.js'
import {fatalError, error} from '../../private/node/ui/error.js'
import React from 'react'
import {AbortController, AbortSignal} from 'abort-controller'
import {EventEmitter} from 'events'

interface RenderConcurrentOptions {
  processes: OutputProcess[]
  onAbort?: (abortSignal: AbortSignal) => void
  stdout?: EventEmitter
}

/**
 * Renders output from concurrent processes to the terminal with {@link ConcurrentOutput}.
 * This function instantiates an `AbortController` so that the various processes can subscribe to the same abort signal.
 */
export async function renderConcurrent({processes, onAbort, stdout}: RenderConcurrentOptions) {
  const abortController = new AbortController()
  if (onAbort) onAbort(abortController.signal)

  const runProcesses = async (writableStream: WritableStream) => {
    try {
      await Promise.all(
        processes.map(async (process, index) => {
          const stdout = writableStream(process, index)
          const stderr = writableStream(process, index)

          await process.action(stdout, stderr, abortController.signal)
        }),
      )

      abortController.abort()
    } catch (error) {
      abortController.abort()
      throw error
    }
  }

  const {unmount, waitUntilExit} = render(
    <ConcurrentOutput processes={processes} runProcesses={runProcesses} />,
    stdout,
  )

  abortController.signal.addEventListener('abort', () => {
    unmount()
  })

  return waitUntilExit()
}

type RenderAlertOptions = Omit<AlertProps, 'type'>

/**
 * Renders an information banner to the console.
 *
 * Basic:
 *
 * ```
 * ╭ info ────────────────────────────────────────────────────╮
 * │                                                          │
 * │ Body                                                     │
 * │                                                          │
 * ╰──────────────────────────────────────────────────────────╯
 * ```
 *
 * Complete:
 * ```
 * ╭ info ────────────────────────────────────────────────────╮
 * │                                                          │
 * │ Title                                                    │
 * │                                                          │
 * │ Body                                                     │
 * │                                                          │
 * │ Next steps                                               │
 * │   • Run cd santorini-goods                               │
 * │   • To preview your project, run npm app dev             │
 * │   • To add extensions, run npm generate extension        │
 * │                                                          │
 * │ Reference                                                │
 * │   • Run npm shopify help                                 │
 * │   • Press 'return' to open the dev docs:                 │
 * │     https://shopify.dev                                  │
 * │                                                          │
 * │ Link: https://shopify.com                                │
 * │                                                          │
 * ╰──────────────────────────────────────────────────────────╯
 * ```
 */
export function renderInfo(options: RenderAlertOptions) {
  alert({...options, type: 'info'})
}

/**
 * Renders a success banner to the console.
 *
 * Basic:
 *
 * ```
 * ╭ success ─────────────────────────────────────────────────╮
 * │                                                          │
 * │ Body                                                     │
 * │                                                          │
 * ╰──────────────────────────────────────────────────────────╯
 * ```
 *
 * Complete:
 * ```
 * ╭ success ─────────────────────────────────────────────────╮
 * │                                                          │
 * │ Title                                                    │
 * │                                                          │
 * │ Body                                                     │
 * │                                                          │
 * │ Next steps                                               │
 * │   • Run cd santorini-goods                               │
 * │   • To preview your project, run npm app dev             │
 * │   • To add extensions, run npm generate extension        │
 * │                                                          │
 * │ Reference                                                │
 * │   • Run npm shopify help                                 │
 * │   • Press 'return' to open the dev docs:                 │
 * │     https://shopify.dev                                  │
 * │                                                          │
 * │ Link: https://shopify.com                                │
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
 * ╭ warning ─────────────────────────────────────────────────╮
 * │                                                          │
 * │ Body                                                     │
 * │                                                          │
 * ╰──────────────────────────────────────────────────────────╯
 * ```
 *
 * Complete:
 * ```
 * ╭ warning ─────────────────────────────────────────────────╮
 * │                                                          │
 * │ Title                                                    │
 * │                                                          │
 * │ Body                                                     │
 * │                                                          │
 * │ Next steps                                               │
 * │   • Run cd santorini-goods                               │
 * │   • To preview your project, run npm app dev             │
 * │   • To add extensions, run npm generate extension        │
 * │                                                          │
 * │ Reference                                                │
 * │   • Run npm shopify help                                 │
 * │   • Press 'return' to open the dev docs:                 │
 * │     https://shopify.dev                                  │
 * │                                                          │
 * │ Link: https://shopify.com                                │
 * │                                                          │
 * ╰──────────────────────────────────────────────────────────╯
 * ```
 */
export function renderWarning(options: RenderAlertOptions) {
  alert({...options, type: 'warning'})
}

export interface RenderErrorOptions {
  headline: string
  tryMessages?: string[]
}

/**
 * Renders a Fatal error to the console inside a banner.
 *
 * ```
 * ╭ error ───────────────────────────────────────────────────╮
 * │                                                          │
 * │ Couldn't connect to the Shopify Partner Dashboard.       │
 * │                                                          │
 * │ What to try                                              │
 * │   • Check your internet connection and try again.        │
 * │                                                          │
 * ╰──────────────────────────────────────────────────────────╯
 * ```
 */
export function renderFatalError(error: Fatal) {
  fatalError(error)
}

/**
 * Renders a generic error to the console inside a banner.
 *
 * ```
 * ╭ error ───────────────────────────────────────────────────╮
 * │                                                          │
 * │ Something went wrong.                                    │
 * │                                                          │
 * │ What to try                                              │
 * │   • Check your internet connection.                      │
 * │   • Try again.                                           │
 * │                                                          │
 * ╰──────────────────────────────────────────────────────────╯
 * ```
 */
export function renderError(options: RenderErrorOptions) {
  error(options)
}
