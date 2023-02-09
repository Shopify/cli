/* eslint-disable tsdoc/syntax */
import {AbortSilentError, FatalError as Fatal} from './error.js'
import {collectLog, consoleError, consoleLog, Logger, LogLevel, outputDebug, outputWhereAppropriate} from './output.js'
import {isUnitTest} from './context/local.js'
import {ConcurrentOutput, ConcurrentOutputProps} from '../../private/node/ui/components/ConcurrentOutput.js'
import {render, renderOnce} from '../../private/node/ui.js'
import {alert, AlertOptions} from '../../private/node/ui/alert.js'
import {CustomSection} from '../../private/node/ui/components/Alert.js'
import {FatalError} from '../../private/node/ui/components/FatalError.js'
import ScalarDict from '../../private/node/ui/components/Table/ScalarDict.js'
import {Table, TableColumn, TableProps} from '../../private/node/ui/components/Table/Table.js'
import {SelectPrompt, SelectPromptProps} from '../../private/node/ui/components/SelectPrompt.js'
import {Tasks, Task} from '../../private/node/ui/components/Tasks.js'
import {TextPrompt, TextPromptProps} from '../../private/node/ui/components/TextPrompt.js'
import {AutocompletePromptProps, AutocompletePrompt} from '../../private/node/ui/components/AutocompletePrompt.js'
import {InlineToken, LinkToken, TokenItem} from '../../private/node/ui/components/TokenizedText.js'
import React from 'react'
import {Key as InkKey, RenderOptions} from 'ink'
import {AbortController} from '@shopify/cli-kit/node/abort'

type PartialBy<T, TKey extends keyof T> = Omit<T, TKey> & Partial<Pick<T, TKey>>

export interface RenderConcurrentOptions extends PartialBy<ConcurrentOutputProps, 'abortController'> {
  renderOptions?: RenderOptions
}

/**
 * Renders output from concurrent processes to the terminal with {@link ConcurrentOutput}.
 * @example
 * 2023-02-09 02:09:06 | backend  | first backend message
 * 2023-02-09 02:09:06 | backend  | second backend message
 * 2023-02-09 02:09:06 | backend  | third backend message
 * 2023-02-09 02:09:06 | frontend | first frontend message
 * 2023-02-09 02:09:06 | frontend | second frontend message
 * 2023-02-09 02:09:06 | frontend | third frontend message
 *
 *
 *   Press `p` to open your browser. Press `q` to quit.
 *
 *
 * Preview URL: https://shopify.com
 *
 */
export async function renderConcurrent({renderOptions, ...props}: RenderConcurrentOptions) {
  const newProps = {
    abortController: new AbortController(),
    ...props,
  }

  return render(<ConcurrentOutput {...newProps} />, {
    ...renderOptions,
    exitOnCtrlC: typeof props.onInput === 'undefined',
  })
}

export type AlertCustomSection = CustomSection
export type RenderAlertOptions = Omit<AlertOptions, 'type'>

/**
 * Renders an information banner to the console.
 * @example Basic
 * ╭─ info ─────────────────────────────────────────────────────────────╮
 * │                                                                    │
 * │  CLI update available                                              │
 * │                                                                    │
 * │  Run `npm run shopify upgrade`.                                    │
 * │                                                                    │
 * ╰────────────────────────────────────────────────────────────────────╯
 *
 * @example Complete
 * ╭─ info ─────────────────────────────────────────────────────────────╮
 * │                                                                    │
 * │  my-app initialized and ready to build.                            │
 * │                                                                    │
 * │  Next steps                                                        │
 * │    • Run `cd verification-app`                                     │
 * │    • To preview your project, run `npm app dev`                    │
 * │    • To add extensions, run `npm generate extension`               │
 * │                                                                    │
 * │  Reference                                                         │
 * │    • Run `npm shopify help`                                        │
 * │    • Dev docs ( https://shopify.dev )                              │
 * │                                                                    │
 * │  Custom section                                                    │
 * │    • Item 1                                                        │
 * │    • Item 2                                                        │
 * │    • Item 3                                                        │
 * │                                                                    │
 * ╰────────────────────────────────────────────────────────────────────╯
 *
 */
export function renderInfo(options: RenderAlertOptions) {
  return alert({...options, type: 'info'})
}

/**
 * Renders a success banner to the console.
 * @example Basic
 * ╭─ success ──────────────────────────────────────────────────────────╮
 * │                                                                    │
 * │  CLI updated.                                                      │
 * │                                                                    │
 * │  You are now running version 3.47.                                 │
 * │                                                                    │
 * ╰────────────────────────────────────────────────────────────────────╯
 *
 * @example Complete
 * ╭─ success ──────────────────────────────────────────────────────────╮
 * │                                                                    │
 * │  Deployment successful.                                            │
 * │                                                                    │
 * │  Your extensions have been uploaded to your Shopify Partners       │
 * │  Dashboard.                                                        │
 * │                                                                    │
 * │  Next steps                                                        │
 * │    • See your deployment and set it live ( https://partners.shopi  │
 * │      fy.com/1797046/apps/4523695/deployments )                     │
 * │                                                                    │
 * ╰────────────────────────────────────────────────────────────────────╯
 *
 */
export function renderSuccess(options: RenderAlertOptions) {
  return alert({...options, type: 'success'})
}

/**
 * Renders a warning banner to the console.
 * @example Basic
 * ╭─ warning ──────────────────────────────────────────────────────────╮
 * │                                                                    │
 * │  You have reached your limit of checkout extensions for this app.  │
 * │                                                                    │
 * │  You can free up space for a new one by deleting an existing one.  │
 * │                                                                    │
 * ╰────────────────────────────────────────────────────────────────────╯
 *
 * @example Complete
 * ╭─ warning ──────────────────────────────────────────────────────────╮
 * │                                                                    │
 * │  Required access scope update.                                     │
 * │                                                                    │
 * │  The deadline for re-selecting your app scopes is May 1, 2022.     │
 * │                                                                    │
 * │  Reference                                                         │
 * │    • Dev docs ( https://shopify.dev/app/scopes )                   │
 * │                                                                    │
 * ╰────────────────────────────────────────────────────────────────────╯
 *
 */
export function renderWarning(options: RenderAlertOptions) {
  return alert({...options, type: 'warning'})
}

interface RenderFatalErrorOptions {
  renderOptions?: RenderOptions
}

/**
 * Renders a Fatal error to the console inside a banner.
 * @example Basic
 * ╭─ error ────────────────────────────────────────────────────────────╮
 * │                                                                    │
 * │  Something went wrong.                                             │
 * │                                                                    │
 * │  To investigate the issue, examine this stack trace:               │
 * │    at _compile (internal/modules/cjs/loader.js:1137)               │
 * │    at js (internal/modules/cjs/loader.js:1157)                     │
 * │    at load (internal/modules/cjs/loader.js:985)                    │
 * │    at _load (internal/modules/cjs/loader.js:878)                   │
 * │                                                                    │
 * ╰────────────────────────────────────────────────────────────────────╯
 *
 * @example Complete
 * ╭─ error ────────────────────────────────────────────────────────────╮
 * │                                                                    │
 * │  No Organization found                                             │
 * │                                                                    │
 * │  Next steps                                                        │
 * │    • Have you created a Shopify Partners organization (            │
 * │      https://partners.shopify.com/signup )?                        │
 * │    • Have you confirmed your accounts from the emails you          │
 * │      received?                                                     │
 * │    • Need to connect to a different App or organization? Run the   │
 * │      command again with `--reset`                                  │
 * │                                                                    │
 * ╰────────────────────────────────────────────────────────────────────╯
 *
 */
// eslint-disable-next-line max-params
export function renderFatalError(error: Fatal, {renderOptions}: RenderFatalErrorOptions = {}) {
  return renderOnce(<FatalError error={error} />, {logLevel: 'error', logger: consoleError, renderOptions})
}

export interface RenderSeletPromptOptions<T> extends Omit<SelectPromptProps<T>, 'onSubmit'> {
  renderOptions?: RenderOptions
}

/**
 * Renders a select prompt to the console.
 * @example
 * ?  Associate your project with the org Castile Ventures?
 *
 *        Add:     • new-ext
 *
 *        Remove:  • integrated-demand-ext
 *                 • order-discount
 *
 *    Automations
 * >  (a) fifth
 *    (2) sixth
 *
 *    Merchant Admin
 *    (3) eighth
 *    (4) ninth
 *
 *    Other
 *    (f) first
 *    (s) second
 *    (7) third
 *    (8) fourth
 *    (9) seventh
 *    (10) tenth
 *
 *    Press ↑↓ arrows to select, enter to confirm
 *
 *
 */
export function renderSelectPrompt<T>({renderOptions, ...props}: RenderSeletPromptOptions<T>): Promise<T> {
  // eslint-disable-next-line max-params
  return new Promise((resolve, reject) => {
    render(<SelectPrompt {...props} onSubmit={(value: T) => resolve(value)} />, {
      ...renderOptions,
      exitOnCtrlC: false,
    }).catch(reject)
  })
}

export interface RenderConfirmationPromptOptions extends Pick<SelectPromptProps<boolean>, 'message' | 'infoTable'> {
  confirmationMessage?: string
  cancellationMessage?: string
  renderOptions?: RenderOptions
}

/**
 * Renders a confirmation prompt to the console.
 * @example
 * ?  Delete the following themes from the store?
 *
 *        • first theme (#1)
 *        • second theme (#2)
 *
 * >  (y) Yes, confirm changes
 *    (n) Cancel
 *
 *    Press ↑↓ arrows to select, enter or a shortcut to confirm
 *
 *
 */
export function renderConfirmationPrompt({
  message,
  infoTable,
  confirmationMessage = 'Yes, confirm',
  cancellationMessage = 'No, cancel',
  renderOptions,
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
    submitWithShortcuts: true,
    renderOptions,
  })
}

export interface RenderAutocompleteOptions<T>
  extends PartialBy<Omit<AutocompletePromptProps<T>, 'onSubmit'>, 'search'> {
  renderOptions?: RenderOptions
}

/**
 * Renders an autocomplete prompt to the console.
 * @example
 * ?  Select a template:   Type to search...
 *
 * >  first
 *    second
 *    third
 *    fourth
 *    fifth
 *    sixth
 *    seventh
 *    eighth
 *    ninth
 *    tenth
 *    eleventh
 *    twelfth
 *    thirteenth
 *    fourteenth
 *    fifteenth
 *    sixteenth
 *    seventeenth
 *    eighteenth
 *    nineteenth
 *    twentieth
 *    twenty-first
 *    twenty-second
 *    twenty-third
 *    twenty-fourth
 *    twenty-fifth
 *
 *    Press ↑↓ arrows to select, enter to confirm
 *
 *
 */
export function renderAutocompletePrompt<T>({renderOptions, ...props}: RenderAutocompleteOptions<T>): Promise<T> {
  const newProps = {
    search(term: string) {
      return Promise.resolve({
        data: props.choices.filter((item) => item.label.toLowerCase().includes(term.toLowerCase())),
      })
    },
    ...props,
  }

  // eslint-disable-next-line max-params
  return new Promise((resolve, reject) => {
    render(<AutocompletePrompt {...newProps} onSubmit={(value: T) => resolve(value)} />, {
      ...renderOptions,
      exitOnCtrlC: false,
    }).catch(reject)
  })
}

interface RenderTableOptions<T extends ScalarDict> extends TableProps<T> {
  renderOptions?: RenderOptions
}

/**
 * Renders a table to the console.
 * @example
 * ID  Name        email
 * ──  ──────────  ─────────────
 * 1   John Doe    jon@doe.com
 * 2   Jane Doe    jane@doe.com
 * 3   John Smith  jon@smith.com
 */
export function renderTable<T extends ScalarDict>({renderOptions, ...props}: RenderTableOptions<T>) {
  return renderOnce(<Table {...props} />, {renderOptions})
}

interface RenderTasksOptions {
  renderOptions?: RenderOptions
}

/**
 * Runs async tasks and displays their progress to the console.
 * @example
 * ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀
 * Installing dependencies ...
 *
 */
// eslint-disable-next-line max-params
export async function renderTasks<TContext>(tasks: Task<TContext>[], {renderOptions}: RenderTasksOptions = {}) {
  return render(<Tasks tasks={tasks} />, renderOptions)
}

export interface RenderTextPromptOptions extends Omit<TextPromptProps, 'onSubmit'> {
  renderOptions?: RenderOptions
}

/**
 * Renders a text prompt to the console.
 * @example
 * ?  App project name (can be changed later):
 * >  expansive commerce app
 *    ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔
 *
 *
 */
export function renderTextPrompt({renderOptions, ...props}: RenderTextPromptOptions): Promise<string> {
  // eslint-disable-next-line max-params
  return new Promise((resolve, reject) => {
    render(<TextPrompt {...props} onSubmit={(value: string) => resolve(value)} />, {
      ...renderOptions,
      exitOnCtrlC: false,
    }).catch(reject)
  })
}

interface RenderTextOptions {
  text: string
  logLevel?: LogLevel
  logger?: Logger
}

/** Renders a text string to the console.
 * Using this function makes sure that correct spacing is applied among the various components.
 * @example
 * Hello world!
 *
 */
export function renderText({text, logLevel = 'info', logger = consoleLog}: RenderTextOptions) {
  let textWithLineReturn = text
  if (!text.endsWith('\n')) textWithLineReturn += '\n'

  if (isUnitTest()) collectLog(logLevel, textWithLineReturn)
  outputWhereAppropriate(logLevel, logger, textWithLineReturn)
  return textWithLineReturn
}

/** Waits for any key to be pressed except Ctrl+C which will terminate the process. */
export const keypress = async () => {
  // eslint-disable-next-line max-params
  return new Promise((resolve, reject) => {
    const handler = (buffer: Buffer) => {
      process.stdin.setRawMode(false)
      process.stdin.pause()

      const bytes = Array.from(buffer)

      if (bytes.length && bytes[0] === 3) {
        outputDebug('Canceled keypress, User pressed CTRL+C')
        reject(new AbortSilentError())
      }
      process.nextTick(resolve)
    }

    process.stdin.resume()
    process.stdin.setRawMode(true)
    process.stdin.once('data', handler)
  })
}

export type Key = InkKey
export {Task, TokenItem, InlineToken, LinkToken, TableColumn}
