import {WizardPromptKind} from './parameters.js'

/**
 * A value the user provided for a flag during the fill phase.
 */
export interface WizardFlagAnswer {
  name: string
  kind: WizardPromptKind
  value: string | boolean
  /**
   * For boolean flags only: whether the flag accepts the negated `--no-<name>`
   * form, which lets a `false` answer be represented explicitly.
   */
  allowNo?: boolean
}

/**
 * A value the user provided for a positional arg during the fill phase.
 */
export interface WizardArgAnswer {
  name: string
  value: string
}

/**
 * Assembles the argv tokens to pass to `Config.runCommand(id, tokens)`. The
 * command id is intentionally NOT included — `runCommand` receives it separately.
 *
 * Positional args come first, in the order provided (declared order), followed by
 * the flag tokens. A boolean flag contributes `--name` when true; when false it
 * contributes the negated `--no-name` if the flag accepts it (`allowNo`), and
 * otherwise nothing (its default polarity). Every other flag contributes
 * `--name value`.
 */
export function assembleCommandTokens(args: WizardArgAnswer[], flags: WizardFlagAnswer[]): string[] {
  const argTokens = args.map((arg) => arg.value)
  const flagTokens = flags.flatMap((flag) => {
    if (flag.kind === 'boolean') {
      if (flag.value === true) return [`--${flag.name}`]
      return flag.allowNo ? [`--no-${flag.name}`] : []
    }
    return [`--${flag.name}`, String(flag.value)]
  })
  return [...argTokens, ...flagTokens]
}

/**
 * Builds a readable, single-line preview of the command that will run. The
 * colon-separated command id is shown in the space-separated form users type
 * (eg `app dev`), and tokens containing whitespace are quoted.
 *
 * Note: the quoting here is DISPLAY-ONLY. Execution is unaffected — the tokens
 * are handed to `Config.runCommand` as a pre-split array, so a value with spaces
 * is already a single argv element and never needs shell-style quoting to survive.
 */
export function previewCommandLine(binName: string, commandId: string, tokens: string[]): string {
  const displayId = commandId.replace(/:/g, ' ')
  return [binName, displayId, ...tokens.map(quoteIfNeeded)].join(' ')
}

function quoteIfNeeded(token: string): string {
  return /\s/.test(token) ? `"${token}"` : token
}
