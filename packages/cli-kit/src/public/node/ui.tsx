import ConcurrentOutput from '../../private/node/ui/components/ConcurrentOutput.js'
import {OutputProcess} from '../../output.js'
import {render} from '../../private/node/ui.js'
import {Fatal} from '../../error.js'
import {alert} from '../../private/node/ui/alert.js'
import {fatalError, error} from '../../private/node/ui/error.js'
import {AlertProps} from '../../private/node/ui/components/Alert.js'
import {ErrorProps} from '../../private/node/ui/components/Error.js'
import React from 'react'
import {AbortController} from 'abort-controller'

interface RenderConcurrentOptions {
  processes: OutputProcess[]
  abortController: AbortController
}

/**
 * Renders output from concurrent processes to the terminal with {@link ConcurrentOutput}.
 */
export async function renderConcurrent({processes, abortController}: RenderConcurrentOptions) {
  const {waitUntilExit} = render(<ConcurrentOutput processes={processes} abortController={abortController} />)

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
export function renderError(options: ErrorProps) {
  error(options)
}
