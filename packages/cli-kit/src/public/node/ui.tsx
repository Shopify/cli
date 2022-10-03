import ConcurrentOutput from '../../private/node/components/ConcurrentOutput.js'
import {OutputProcess} from '../../output.js'
import {render, BannerProps, banner} from '../../private/node/ui.js'
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

type RenderBannerOptions = Omit<BannerProps, 'type'>

/**
 * Renders information to the console in the form of:
 *
 * ```
 * ╭─ info ───────────────────────────────────────────────────╮
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
 * @param {RenderBannerOptions} options
 */
export function renderInfo(options: RenderBannerOptions) {
  banner({...options, type: 'info'})
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
 * @param {RenderBannerOptions} options
 */
export function renderSuccess(options: RenderBannerOptions) {
  banner({...options, type: 'success'})
}

/**
 * Renders a warning message to the console in the form of:
 *
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
 * @param {RenderBannerOptions} options
 */
export function renderWarning(options: RenderBannerOptions) {
  banner({...options, type: 'warning'})
}

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
 * @param {RenderBannerOptions} options
 */
export function renderError(options: RenderBannerOptions) {
  banner({...options, type: 'error'})
}
