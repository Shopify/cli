import ConcurrentOutput from '../../private/node/ui/components/ConcurrentOutput.js'
import {consoleError, OutputProcess} from '../../output.js'
import {render, renderOnce} from '../../private/node/ui.js'
import {Fatal} from '../../error.js'
import {alert} from '../../private/node/ui/alert.js'
import {AlertProps} from '../../private/node/ui/components/Alert.js'
import {FatalError} from '../../private/node/ui/components/FatalError.js'
import {SelectPrompt, Props as SelectPromptProps} from '../../private/node/ui/components/SelectPrompt.js'
import {Tasks, Task} from '../../private/node/ui/components/Tasks.js'
import {TextPrompt, Props as TextPromptProps} from '../../private/node/ui/components/TextPrompt.js'
import {
  AutocompletePrompt,
  Props as AutocompletePromptProps,
} from '../../private/node/ui/components/AutocompletePrompt.js'
import React from 'react'
import {RenderOptions} from 'ink'
import {AbortController} from '@shopify/cli-kit/node/abort'

interface RenderConcurrentOptions {
  processes: OutputProcess[]
  abortController?: AbortController
  showTimestamps?: boolean
  renderOptions?: RenderOptions
}

/**
 * Renders output from concurrent processes to the terminal with {@link ConcurrentOutput}.
 */
export async function renderConcurrent({
  processes,
  abortController,
  showTimestamps = true,
  renderOptions = {},
}: RenderConcurrentOptions) {
  return render(
    <ConcurrentOutput
      processes={processes}
      abortController={abortController ?? new AbortController()}
      showTimestamps={showTimestamps}
    />,
    renderOptions,
  )
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
  return alert({...options, type: 'info'})
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
  return alert({...options, type: 'success'})
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
  return alert({...options, type: 'warning'})
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
  return renderOnce(<FatalError error={error} />, 'error', consoleError)
}

/**
 * Renders a select prompt to the console.
 *
 * ?  Associate your project with the org Castile Ventures?
 *
 *      Add:     • new-ext
 *
 *      Remove:  • integrated-demand-ext
 *               • order-discount

 * \>  (f) first
 *     (s) second
 *     (3) third
 *     (4) fourth
 *     (5) seventh
 *     (6) tenth

 *     Automations
 *     (7) fifth
 *     (8) sixth

 *     Merchant Admin
 *     (9) eighth
 *     (10) ninth

 *     navigate with arrows, enter to select
 */
export function renderSelectPrompt<T>(props: Omit<SelectPromptProps<T>, 'onSubmit'>): Promise<T> {
  return new Promise((resolve, reject) => {
    render(<SelectPrompt {...props} onSubmit={(value: T) => resolve(value)} />, {
      exitOnCtrlC: false,
    }).catch(reject)
  })
}

/**
 * Renders an autocomplete prompt to the console.
 *
 * ?  Select a template  Type to search...

 * \>  first
 *     second
 *     third

 *  navigate with arrows, enter to select
 */
export function renderAutocompletePrompt<T>(props: Omit<AutocompletePromptProps<T>, 'onSubmit'>): Promise<T> {
  const newProps = {
    search(term: string) {
      return Promise.resolve(props.choices.filter((item) => item.label.toLowerCase().includes(term.toLowerCase())))
    },
    ...props,
  }

  return new Promise((resolve, reject) => {
    render(<AutocompletePrompt {...newProps} onSubmit={(value: T) => resolve(value)} />, {
      exitOnCtrlC: false,
    }).catch(reject)
  })
}

/**
 * Runs async tasks and displays their progress to the console.
 */
export async function renderTasks<TContext>(tasks: Task<TContext>[], options: {silent?: boolean} = {silent: false}) {
  return render(<Tasks tasks={tasks} silent={options.silent} />)
}

/**
 * Renders a text prompt to the console.
 *
 * ?  What is your name?
 * \>  John
 */
export function renderTextPrompt(props: Omit<TextPromptProps, 'onSubmit'>): Promise<string> {
  return new Promise((resolve, reject) => {
    render(<TextPrompt {...props} onSubmit={(value: string) => resolve(value)} />, {
      exitOnCtrlC: false,
    }).catch(reject)
  })
}
