/* eslint-disable tsdoc/syntax */
import {runWithTimer} from './metadata.js'
import {terminalSupportsRawMode} from './system.js'
import {outputContent, outputDebug, outputToken} from './output.js'
import {AbortSilentError, AbortError} from './error.js'
import {render} from '../../private/node/ui.js'
import {TokenItem, tokenItemToString} from '../../private/node/ui/components/TokenizedText.js'
import {
  DangerousConfirmationPrompt,
  DangerousConfirmationPromptProps,
} from '../../private/node/ui/components/DangerousConfirmationPrompt.js'
import {SelectPrompt, SelectPromptProps} from '../../private/node/ui/components/SelectPrompt.js'
import {TextPrompt, TextPromptProps} from '../../private/node/ui/components/TextPrompt.js'
import {AutocompletePromptProps, AutocompletePrompt} from '../../private/node/ui/components/AutocompletePrompt.js'
import {recordUIEvent, resetRecordedSleep} from '../../private/node/demo-recorder.js'
import {PartialBy} from '../common/ts/partial-by.js'
import React from 'react'
import {RenderOptions} from 'ink'

export interface UIDebugOptions {
  /** If true, don't check if the current terminal is interactive or not */
  skipTTYCheck?: boolean
}
export const defaultUIDebugOptions: UIDebugOptions = {
  skipTTYCheck: false,
}

export interface RenderSelectPromptOptions<T> extends Omit<SelectPromptProps<T>, 'onSubmit'> {
  isConfirmationPrompt?: boolean
  renderOptions?: RenderOptions
}

/**
 * Renders a select prompt to the console.
 * @example
 * ?  Associate your project with the org Castile Ventures?
 *
 *    ┃  Add
 *    ┃  • new-ext
 *    ┃
 *    ┃  Remove
 *    ┃  • integrated-demand-ext
 *    ┃  • order-discount
 *
 *    Automations
 *    >  fifth
 *       sixth
 *
 *    Merchant Admin
 *       eighth
 *       ninth
 *
 *    Other
 *       first
 *       second
 *       third (limit reached)
 *       fourth
 *       seventh
 *       tenth
 *
 *    Press ↑↓ arrows to select, enter to confirm.
 *
 */

export async function renderSelectPrompt<T>(
  {renderOptions, isConfirmationPrompt, ...props}: RenderSelectPromptOptions<T>,
  uiDebugOptions: UIDebugOptions = defaultUIDebugOptions,
): Promise<T> {
  throwInNonTTY({message: props.message, stdin: renderOptions?.stdin}, uiDebugOptions)

  if (!isConfirmationPrompt) {
    recordUIEvent({type: 'selectPrompt', properties: {renderOptions, ...props}})
  }

  return runWithTimer('cmd_all_timing_prompts_ms')(async () => {
    let selectedValue: T
    try {
      await render(
        <SelectPrompt
          {...props}
          onSubmit={(value: T) => {
            selectedValue = value
          }}
        />,
        {
          ...renderOptions,
          exitOnCtrlC: false,
        },
      )
      return selectedValue!
    } finally {
      resetRecordedSleep()
    }
  })
}

export interface RenderConfirmationPromptOptions
  extends Pick<SelectPromptProps<boolean>, 'message' | 'infoTable' | 'infoMessage' | 'abortSignal'> {
  confirmationMessage?: string
  cancellationMessage?: string
  renderOptions?: RenderOptions
  defaultValue?: boolean
}

/**
 * Renders a confirmation prompt to the console.
 * @example
 * ?  Delete the following themes from the store?
 *
 *    ┃  Info message title
 *    ┃
 *    ┃  Info message body
 *    ┃
 *    ┃  • first theme (#1)
 *    ┃  • second theme (#2)
 *
 * >  (y) Yes, confirm changes
 *    (n) Cancel
 *
 *    Press ↑↓ arrows to select, enter or a shortcut to
 *    confirm.
 *
 */
export async function renderConfirmationPrompt({
  message,
  infoTable,
  confirmationMessage = 'Yes, confirm',
  cancellationMessage = 'No, cancel',
  renderOptions,
  defaultValue = true,
  abortSignal,
  infoMessage,
}: RenderConfirmationPromptOptions): Promise<boolean> {
  // eslint-disable-next-line prefer-rest-params
  recordUIEvent({type: 'confirmationPrompt', properties: arguments[0]})

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
    renderOptions,
    defaultValue,
    isConfirmationPrompt: true,
    abortSignal,
    infoMessage,
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
 *    ┃  Info message title
 *    ┃
 *    ┃  Info message body
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
 *    nineteenth (disabled)
 *    twentieth
 *    twenty-first
 *    twenty-second
 *    twenty-third
 *    twenty-fourth
 *    twenty-fifth
 *
 *    Press ↑↓ arrows to select, enter to confirm.
 *
 */

export async function renderAutocompletePrompt<T>(
  {renderOptions, ...props}: RenderAutocompleteOptions<T>,
  uiDebugOptions: UIDebugOptions = defaultUIDebugOptions,
): Promise<T> {
  throwInNonTTY({message: props.message, stdin: renderOptions?.stdin}, uiDebugOptions)

  // eslint-disable-next-line prefer-rest-params
  recordUIEvent({type: 'autocompletePrompt', properties: arguments[0]})

  const newProps = {
    search(term: string) {
      const lowerTerm = term.toLowerCase()
      return Promise.resolve({
        data: props.choices.filter((item) => {
          return (
            item.label.toLowerCase().includes(lowerTerm) || (item.group && item.group.toLowerCase().includes(lowerTerm))
          )
        }),
      })
    },
    ...props,
  }

  return runWithTimer('cmd_all_timing_prompts_ms')(async () => {
    let selectedValue: T
    try {
      await render(
        <AutocompletePrompt
          {...newProps}
          onSubmit={(value: T) => {
            selectedValue = value
          }}
        />,
        {
          ...renderOptions,
          exitOnCtrlC: false,
        },
      )
      return selectedValue!
    } finally {
      resetRecordedSleep()
    }
  })
}

export interface RenderTextPromptOptions extends Omit<TextPromptProps, 'onSubmit'> {
  renderOptions?: RenderOptions
}

/**
 * Renders a text prompt to the console.
 * @example
 * ?  App project name (can be changed later):
 * >  expansive commerce app
 *    ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔
 *
 */

export async function renderTextPrompt(
  {renderOptions, ...props}: RenderTextPromptOptions,
  uiDebugOptions: UIDebugOptions = defaultUIDebugOptions,
): Promise<string> {
  throwInNonTTY({message: props.message, stdin: renderOptions?.stdin}, uiDebugOptions)

  // eslint-disable-next-line prefer-rest-params
  recordUIEvent({type: 'textPrompt', properties: arguments[0]})

  return runWithTimer('cmd_all_timing_prompts_ms')(async () => {
    let enteredText = ''
    try {
      await render(
        <TextPrompt
          {...props}
          onSubmit={(value: string) => {
            enteredText = value
          }}
        />,
        {
          ...renderOptions,
          exitOnCtrlC: false,
        },
      )
      return enteredText
    } finally {
      resetRecordedSleep()
    }
  })
}

export interface RenderDangerousConfirmationPromptOptions extends Omit<DangerousConfirmationPromptProps, 'onSubmit'> {
  renderOptions?: RenderOptions
}

/**
 * Renders a dangerous confirmation prompt to the console, forcing the user to
 * type a confirmation string to proceed.
 * @example
 * ?  Release a new version of nightly-app-2023-06-19?
 *
 *    ┃  Includes:
 *    ┃  + web-px (new)
 *    ┃  + sub-ui-ext
 *    ┃  + theme-app-ext
 *    ┃  + paymentify (from Partner Dashboard)
 *    ┃
 *    ┃  Removes:
 *    ┃  - prod-discount-fun
 *    ┃
 *    ┃  This can permanently delete app user data.
 *
 *    Type nightly-app-2023-06-19 to confirm, or press Escape
 *    to cancel.
 * >  █
 *    ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔
 *
 */

export async function renderDangerousConfirmationPrompt(
  {renderOptions, ...props}: RenderDangerousConfirmationPromptOptions,
  uiDebugOptions: UIDebugOptions = defaultUIDebugOptions,
): Promise<boolean> {
  throwInNonTTY({message: props.message, stdin: renderOptions?.stdin}, uiDebugOptions)

  // eslint-disable-next-line prefer-rest-params
  recordUIEvent({type: 'dangerousConfirmationPrompt', properties: arguments[0]})

  return runWithTimer('cmd_all_timing_prompts_ms')(async () => {
    let confirmed: boolean
    try {
      await render(
        <DangerousConfirmationPrompt
          {...props}
          onSubmit={(value: boolean) => {
            confirmed = value
          }}
        />,
        {
          ...renderOptions,
          exitOnCtrlC: false,
        },
      )
      return confirmed!
    } finally {
      resetRecordedSleep()
    }
  })
}

/** Waits for any key to be pressed except Ctrl+C which will terminate the process. */
export const keypress = async (stdin = process.stdin, uiDebugOptions: UIDebugOptions = defaultUIDebugOptions) => {
  throwInNonTTY({message: 'Press any key'}, uiDebugOptions)

  return runWithTimer('cmd_all_timing_prompts_ms')(() => {
    return new Promise((resolve, reject) => {
      const handler = (buffer: Buffer) => {
        stdin.setRawMode(false)

        const bytes = Array.from(buffer)

        if (bytes.length && bytes[0] === 3) {
          outputDebug('Canceled keypress, User pressed CTRL+C')
          reject(new AbortSilentError())
        }
        stdin.unref()
        process.nextTick(resolve)
      }

      stdin.setRawMode(true)
      stdin.once('data', handler)

      // We want to indicate that we're still using stdin, so that the process
      // doesn't exit early.
      stdin.ref()
    })
  })
}

interface IsTTYOptions {
  stdin?: NodeJS.ReadStream
  uiDebugOptions?: UIDebugOptions
}

export function isTTY({stdin = undefined, uiDebugOptions = defaultUIDebugOptions}: IsTTYOptions = {}) {
  return Boolean(uiDebugOptions.skipTTYCheck || stdin || terminalSupportsRawMode())
}

interface ThrowInNonTTYOptions {
  message: TokenItem
  stdin?: NodeJS.ReadStream
}

function throwInNonTTY({message, stdin = undefined}: ThrowInNonTTYOptions, uiDebugOptions: UIDebugOptions) {
  if (isTTY({stdin, uiDebugOptions})) return

  const promptText = tokenItemToString(message)
  const errorMessage = `Failed to prompt:

  ${outputContent`${outputToken.cyan(promptText)}`.value}

  This usually happens when running a command non-interactively, for example in a CI environment, or when piping input from another process.`
  throw new AbortError(
    errorMessage,
    'To resolve this, specify the option in the command, or run the command in an interactive environment such as your local terminal.',
  )
}
