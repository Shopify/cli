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

/**
 * Renders information to the console in the form of:
 *
 * ```
 * ╭─ info ─────────────────────╮
 * │                            │
 * │ Title                      │
 * │                            │
 * │  Body Text                 │
 * │                            │
 * ╰────────────────────────────╯
 * ```
 * @param {Omit<BannerProps, 'type'>} options
 */
export function renderInfo(options: Omit<BannerProps, 'type'>) {
  banner({...options, type: 'info'})
}

/**
 * Renders a success message to the console in the form of:
 *
 * ```
 * ╭─ success ──────────────────╮
 * │                            │
 * │ Title                      │
 * │                            │
 * │  Body Text                 │
 * │                            │
 * ╰────────────────────────────╯
 * ```
 * @param {Omit<BannerProps, 'type'>} options
 */
export function renderSuccess(options: Omit<BannerProps, 'type'>) {
  banner({...options, type: 'success'})
}

/**
 * Renders a warning message to the console in the form of:
 *
 * ```
 * ╭─ warning ──────────────────╮
 * │                            │
 * │ Title                      │
 * │                            │
 * │  Body Text                 │
 * │                            │
 * ╰────────────────────────────╯
 * ```
 * @param {Omit<BannerProps, 'type'>} options
 */
export function renderWarning(options: Omit<BannerProps, 'type'>) {
  banner({...options, type: 'warning'})
}

/**
 * Renders an error message to the console in the form of:
 *
 * ```
 * ╭─ error ────────────────────
 * │                            │
 * │ Title                      │
 * │                            │
 * │  Body Text                 │
 * │                            │
 * ╰────────────────────────────╯
 * ```
 * @param {Omit<BannerProps, 'type'>} options
 */
export function renderError(options: Omit<BannerProps, 'type'>) {
  banner({...options, type: 'error'})
}
