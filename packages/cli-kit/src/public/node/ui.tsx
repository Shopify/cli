import ConcurrentOutput from '../../private/node/components/ConcurrentOutput.js'
import {OutputProcess} from '../../output.js'
import {render, AlertProps, alert, error, ErrorProps} from '../../private/node/ui.js'
import React from 'react'
import {AbortController, AbortSignal} from 'abort-controller'

/**
 * Renders output from concurrent processes to the terminal with {@link ConcurrentOutput}.
 * This function instantiates an `AbortController` so that the various processes can subscribe to the same abort signal.
 *
 * @param {OutputProcess[]} processes
 * @param {(abortSignal: AbortSignal) => void} [onAbort]
 */
export async function renderConcurrent(processes: OutputProcess[], onAbort?: (abortSignal: AbortSignal) => void) {
  const abortController = new AbortController()
  if (onAbort) onAbort(abortController.signal)

  render(<ConcurrentOutput processes={processes} abortController={abortController} />)
}

type RenderAlertOptions = Omit<AlertProps, 'type'>

/**
 * Renders information to the console in the form of:
 *
 * ```
 * ╭─ info ───────────────────────────────────────────────────╮
│                                                          │
│ Title                                                    │
│                                                          │
│ Body                                                     │
│                                                          │
│ Next Steps                                               │
│   • Run cd santorini-goods                               │
│   • To preview your project, run npm app dev             │
│   • To add extensions, run npm generate extension        │
│                                                          │
│ Reference                                                │
│   • Run npm shopify help                                 │
│   • Press 'return' to open the dev docs:                 │
│     https://shopify.dev                                  │
│                                                          │
│ Link: https://shopify.com                                │
│                                                          │
╰──────────────────────────────────────────────────────────╯
 * ```
 * @param {RenderAlertOptions} options
 */
export function renderInfo(options: RenderAlertOptions) {
  alert({...options, type: 'info'})
}

/**
 * Renders a success message to the console in the form of:
 *
 * ```
 * ╭─ success ────────────────────────────────────────────────╮
 * │                                                          │
 * │ Title                                                    │
 * │                                                          │
 * │ Body                                                     │
 * │                                                          │
 * │ Next Steps                                               │
 * │   • lorem ipsum dolor sit amet consectetur adipiscing    │
 * │     elit sed do eiusmod tempor incididunt ut labore et   │
 * │     dolore magna aliqua                                  │
 * │   • Ut enim ad minim veniam, quis nostrud exercitation   │
 * │     ullamco laboris nisi ut aliquip ex ea commodo        │
 * │     consequat                                            │
 * │                                                          │
 * │ Reference                                                │
 * │   • Reference 1                                          │
 * │   • Reference 2                                          │
 * │                                                          │
 * │ Link: https://shopify.com                                │
 * │                                                          │
 * ╰──────────────────────────────────────────────────────────╯
 * ```
 * @param {RenderAlertOptions} options
 */
export function renderSuccess(options: RenderAlertOptions) {
  alert({...options, type: 'success'})
}

/**
 * Renders a warning message to the console in the form of:
 * @param {RenderAlertOptions} options

 * ```
 * ╭─ success ────────────────────────────────────────────────╮
   │                                                          │
   │ Body                                                     │
   │                                                          │
   ╰──────────────────────────────────────────────────────────╯
```
 * ```
 * ╭─ warning ────────────────────────────────────────────────╮
 * │                                                          │
 * │ Title                                                    │
 * │                                                          │
 * │ Body                                                     │
 * │                                                          │
 * │ Next Steps                                               │
 * │   • lorem ipsum dolor sit amet consectetur adipiscing    │
 * │     elit sed do eiusmod tempor incididunt ut labore et   │
 * │     dolore magna aliqua                                  │
 * │   • Ut enim ad minim veniam, quis nostrud exercitation   │
 * │     ullamco laboris nisi ut aliquip ex ea commodo        │
 * │     consequat                                            │
 * │                                                          │
 * │ Reference                                                │
 * │   • Reference 1                                          │
 * │   • Reference 2                                          │
 * │                                                          │
 * │ Link: https://shopify.com                                │
 * │                                                          │
 * ╰──────────────────────────────────────────────────────────╯
 * ```
 */
export function renderWarning(options: RenderAlertOptions) {
  alert({...options, type: 'warning'})
}

type RenderErrorOptions = ErrorProps

/**
 * Renders an error message to the console in the form of:
 *
 * ```
 * ╭─ error ──────────────────────────────────────────────────╮
 * │                                                          │
 * │ Title                                                    │
 * │                                                          │
 * │ Body                                                     │
 * │                                                          │
 * │ Next Steps                                               │
 * │   • lorem ipsum dolor sit amet consectetur adipiscing    │
 * │     elit sed do eiusmod tempor incididunt ut labore et   │
 * │     dolore magna aliqua                                  │
 * │   • Ut enim ad minim veniam, quis nostrud exercitation   │
 * │     ullamco laboris nisi ut aliquip ex ea commodo        │
 * │     consequat                                            │
 * │                                                          │
 * │ Reference                                                │
 * │   • Reference 1                                          │
 * │   • Reference 2                                          │
 * │                                                          │
 * │ Link: https://shopify.com                                │
 * │                                                          │
 * ╰──────────────────────────────────────────────────────────╯
 * ```
 * @param {RenderErrorOptions} options
 */
export function renderError(options: RenderErrorOptions) {
  error(options)
}
