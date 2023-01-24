import {isUnitTest} from './environment/local.js'
import {FatalError as Fatal} from './error.js'
import ConcurrentOutput, {Props as ConcurrentOutputProps} from '../../private/node/ui/components/ConcurrentOutput.js'
import {consoleError} from '../../output.js'
import {render, renderOnce} from '../../private/node/ui.js'
import {alert} from '../../private/node/ui/alert.js'
import {AlertProps} from '../../private/node/ui/components/Alert.js'
import {FatalError} from '../../private/node/ui/components/FatalError.js'
import ScalarDict from '../../private/node/ui/components/Table/ScalarDict.js'
import Table, {TableProps} from '../../private/node/ui/components/Table/Table.js'
import {SelectPrompt, Props as SelectPromptProps} from '../../private/node/ui/components/SelectPrompt.js'
import {Tasks, Task} from '../../private/node/ui/components/Tasks.js'
import {TextPrompt, Props as TextPromptProps} from '../../private/node/ui/components/TextPrompt.js'
import {
  Props as AutocompletePromptProps,
  AutocompletePrompt,
} from '../../private/node/ui/components/AutocompletePrompt.js'
import React from 'react'
import {Key as InkKey, RenderOptions} from 'ink'
import {AbortController} from '@shopify/cli-kit/node/abort'

type PartialBy<T, TKey extends keyof T> = Omit<T, TKey> & Partial<Pick<T, TKey>>

interface RenderConcurrentOptions extends PartialBy<ConcurrentOutputProps, 'abortController'> {
  renderOptions?: RenderOptions
}

/**
 * Renders output from concurrent processes to the terminal with {@link ConcurrentOutput}.
 */
export async function renderConcurrent({renderOptions = {}, ...props}: RenderConcurrentOptions) {
  const newProps = {
    abortController: new AbortController(),
    ...props,
  }

  return render(<ConcurrentOutput {...newProps} />, {
    ...renderOptions,
    exitOnCtrlC: typeof props.onInput === 'undefined',
  })
}

export type RenderAlertOptions = Omit<AlertProps, 'type'>

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
 * ```
 * ?  Associate your project with the org Castile Ventures?
 *
 *      Add:     • new-ext
 *
 *      Remove:  • integrated-demand-ext
 *               • order-discount
 *
 * \>  (f) first
 *     (s) second
 *     (3) third
 *     (4) fourth
 *     (5) seventh
 *     (6) tenth
 *
 *     Automations
 *     (7) fifth
 *     (8) sixth
 *
 *     Merchant Admin
 *     (9) eighth
 *     (10) ninth
 *
 *     Press ↑↓ arrows to select, enter to confirm
 * ```
 */
export function renderSelectPrompt<T>(props: Omit<SelectPromptProps<T>, 'onSubmit'>): Promise<T> {
  return new Promise((resolve, reject) => {
    render(<SelectPrompt {...props} onSubmit={(value: T) => resolve(value)} />, {
      exitOnCtrlC: false,
    }).catch(reject)
  })
}

interface RenderConfirmationPromptOptions extends Pick<SelectPromptProps<boolean>, 'message' | 'infoTable'> {
  confirmationMessage?: string
  cancellationMessage?: string
}

/**
 * Renders a confirmation prompt to the console.
 *
 * ?  Do you want to continue?
 *
 * \>  (y) Yes, confirm
 *     (n) No, canccel
 *
 *     Press ↑↓ arrows to select, enter to confirm
 */
export function renderConfirmationPrompt({
  message,
  infoTable,
  confirmationMessage = 'Yes, confirm',
  cancellationMessage = 'No, cancel',
}: RenderConfirmationPromptOptions): Promise<boolean> {
  const choices = [
    {
      label: confirmationMessage,
      value: true,
      key: 'y',
    },
    {
      label: cancellationMessage,
      value: false,
      key: 'n',
    },
  ]

  return renderSelectPrompt({
    choices,
    message,
    infoTable,
  })
}

/**
 * Renders an autocomplete prompt to the console.
 * ```
 * ?  Select a template  Type to search...

 * \>  first
 *     second
 *     third

 *  Press ↑↓ arrows to select, enter to confirm
 * ```
 */
export function renderAutocompletePrompt<T>(
  props: PartialBy<Omit<AutocompletePromptProps<T>, 'onSubmit'>, 'search'>,
): Promise<T> {
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
 * Renders a table to the console.
 *
 * ```
 * name                      role           Identifier
 * ────────────────────────  ─────────────  ──────────
 * Dawn                      [live]         #1361
 * Studio                                   #1363
 * Debut                     [unpublished]  #1374
 * Development (1a23b4-MBP)  [development]  #1368
 * ```
 */
export function renderTable<T extends ScalarDict>(props: TableProps<T>) {
  return renderOnce(<Table {...props} />)
}

/**
 * Runs async tasks and displays their progress to the console.
 */
export async function renderTasks<TContext>(tasks: Task<TContext>[]) {
  return render(<Tasks tasks={tasks} silent={isUnitTest()} />)
}

/**
 * Renders a text prompt to the console.
 * ```
 * ?  What is your name?
 * \>  John
 * ```
 */
export function renderTextPrompt(props: Omit<TextPromptProps, 'onSubmit'>): Promise<string> {
  return new Promise((resolve, reject) => {
    render(<TextPrompt {...props} onSubmit={(value: string) => resolve(value)} />, {
      exitOnCtrlC: false,
    }).catch(reject)
  })
}

export type Key = InkKey
