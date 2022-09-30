import ConcurrentOutput from '../../private/node/components/ConcurrentOutput.js'
import {OutputProcess} from '../../output.js'
import {render, BannerProps, banner} from '../../private/node/ui.js'
import React from 'react'
import {AbortController, AbortSignal} from 'abort-controller'

/**
 * Renders output from concurrent processes to the terminal.
 * Output will be divided in a two column layout, with the left column
 * containing the process prefix and the right column containing the output.
 * Every process will be rendered with a different color, up to 4 colors.
 *
 * For example:
 *
 * backend    |
 * backend    | > shopify-app-template-node@0.1.0 dev
 * backend    | > cross-env NODE_ENV=development nodemon backend/index.js --watch ./backend    |
 * backend    |

 * frontend   |
 * frontend   | > starter-react-frontend-app@0.1.0 dev
 * frontend   | > cross-env NODE_ENV=development node vite-server.js
 * frontend   |

 * backend    | [nodemon] 2.0.19
 * backend    | [nodemon] to restart at any time, enter `rs`
 * backend    | [nodemon] watching path(s): backend/
 * backend    | [nodemon] watching extensions: js,mjs,json
 * backend    | [nodemon] starting `node backend/index.js
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
 * ╭─ info ─────────────────────╮
 * │                            │
 * │ Title                      │
 * │                            │
 * │  Body Text                 │
 * │                            │
 * ╰────────────────────────────╯
 * @param {Omit<BannerProps, 'type'>} options
 */
export function renderInfo(options: Omit<BannerProps, 'type'>) {
  banner({...options, type: 'info'})
}

/**
 * Renders a success message to the console in the form of:
 *
 * ╭─ success ──────────────────╮
 * │                            │
 * │ Title                      │
 * │                            │
 * │  Body Text                 │
 * │                            │
 * ╰────────────────────────────╯
 * @param {Omit<BannerProps, 'type'>} options
 */
export function renderSuccess(options: Omit<BannerProps, 'type'>) {
  banner({...options, type: 'success'})
}

/**
 * Renders a warning message to the console in the form of:
 *
 * ╭─ warning ──────────────────╮
 * │                            │
 * │ Title                      │
 * │                            │
 * │  Body Text                 │
 * │                            │
 * ╰────────────────────────────╯
 * @param {Omit<BannerProps, 'type'>} options
 */
export function renderWarning(options: Omit<BannerProps, 'type'>) {
  banner({...options, type: 'warning'})
}

/**
 * Renders an error message to the console in the form of:
 *
 * ╭─ error ────────────────────
 * │                            │
 * │ Title                      │
 * │                            │
 * │  Body Text                 │
 * │                            │
 * ╰────────────────────────────╯
 * @param {Omit<BannerProps, 'type'>} options
 */
export function renderError(options: Omit<BannerProps, 'type'>) {
  banner({...options, type: 'error'})
}
