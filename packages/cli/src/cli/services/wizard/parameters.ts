import {Command} from '@oclif/core'

/**
 * The kind of prompt a declared flag or arg maps to, derived purely from its
 * static oclif metadata.
 */
export type WizardPromptKind = 'boolean' | 'enum' | 'integer' | 'string'

/**
 * A normalized view of a declared flag, carrying only what the wizard needs to
 * prompt for it. Dynamic values (stores, apps, themes) are deliberately NOT
 * modelled here — those are left to the target command's own runtime prompts.
 *
 * Note: `multiple: true` flags are treated as a single value here — the wizard
 * collects one value for them, which still produces a valid argv the target can
 * parse. Collecting repeated values is out of the thin-wizard scope.
 */
export interface WizardFlagParameter {
  name: string
  kind: WizardPromptKind
  description: string | undefined
  options: string[] | undefined
  required: boolean
  /** Whether a boolean flag accepts the negated `--no-<name>` form. */
  allowNo: boolean
  /** A boolean flag's static default, when it declares one literally. */
  defaultValue: boolean | undefined
}

/**
 * A required "provide one of these" flag group derived from oclif's `exactlyOne`
 * / `atLeastOne` relationships. Members are individually `required: false`, so the
 * wizard would otherwise skip them and hand off an argv the target rejects.
 */
export interface WizardFlagGroup {
  kind: 'exactlyOne' | 'atLeastOne'
  members: WizardFlagParameter[]
}

/**
 * A normalized view of a declared positional arg. Args are always string-like,
 * optionally constrained to a static `options` set (an enum).
 */
export interface WizardArgParameter {
  name: string
  kind: 'enum' | 'string'
  description: string | undefined
  options: string[] | undefined
  required: boolean
}

/**
 * Routes a flag to a prompt kind from its static metadata alone.
 *
 * Note on integers: an unbounded `Flags.integer()` is indistinguishable from a
 * string flag at the metadata level — both are `{type: 'option'}` with a `parse`
 * function and no other marker. Only integers declared with a numeric `min`/`max`
 * expose a detectable signal. Unbounded integers therefore fall back to a string
 * prompt; that's safe because the target command re-parses and validates the
 * value itself after hand-off — the wizard only ever produces string tokens.
 */
export function promptKindForFlag(flag: Command.Flag.Any): WizardPromptKind {
  if (flag.type === 'boolean') return 'boolean'
  if (hasOptions(readFlagOptions(flag))) return 'enum'
  if (isBoundedIntegerFlag(flag)) return 'integer'
  return 'string'
}

/**
 * Routes a positional arg to a prompt kind: an enum when it declares a static
 * `options` set, otherwise a free-text string.
 */
export function promptKindForArg(arg: Command.Arg.Any): 'enum' | 'string' {
  return hasOptions(arg.options) ? 'enum' : 'string'
}

/**
 * Normalizes a command's declared flags into wizard parameters, skipping hidden
 * flags. Order follows the object's declaration order.
 */
export function wizardFlagParameters(flags: {[name: string]: Command.Flag.Any}): WizardFlagParameter[] {
  return Object.entries(flags)
    .filter(([, flag]) => !flag.hidden)
    .map(([name, flag]) => ({
      name,
      kind: promptKindForFlag(flag),
      description: firstLine(flag.summary ?? flag.description),
      options: toMutableOptions(readFlagOptions(flag)),
      required: Boolean(flag.required),
      allowNo: flag.type === 'boolean' ? Boolean((flag as {allowNo?: boolean}).allowNo) : false,
      defaultValue: booleanDefault(flag),
    }))
}

/**
 * Derives the distinct required "provide one of these" groups (`exactlyOne` /
 * `atLeastOne`) from a command's flags. Each member flag carries the full member
 * list, so groups are de-duplicated by their (kind + sorted members) signature.
 * Hidden members are dropped.
 */
export function requiredFlagGroups(flags: {[name: string]: Command.Flag.Any}): WizardFlagGroup[] {
  const parametersByName = new Map(wizardFlagParameters(flags).map((parameter) => [parameter.name, parameter]))
  const groups: WizardFlagGroup[] = []
  const seenSignatures = new Set<string>()

  for (const flag of Object.values(flags)) {
    for (const kind of ['exactlyOne', 'atLeastOne'] as const) {
      const memberNames = readGroupMembers(flag, kind)
      if (!memberNames) continue

      const signature = `${kind}:${[...memberNames].sort().join(',')}`
      if (seenSignatures.has(signature)) continue
      seenSignatures.add(signature)

      const members = memberNames
        .map((name) => parametersByName.get(name))
        .filter((member): member is WizardFlagParameter => member !== undefined)
      if (members.length > 0) groups.push({kind, members})
    }
  }
  return groups
}

/**
 * The required flags the wizard must prompt for before running the command.
 */
export function requiredFlagParameters(flags: {[name: string]: Command.Flag.Any}): WizardFlagParameter[] {
  return wizardFlagParameters(flags).filter((parameter) => parameter.required)
}

/**
 * The optional flags the wizard offers via the multi-select "set optional flags"
 * step.
 */
export function optionalFlagParameters(flags: {[name: string]: Command.Flag.Any}): WizardFlagParameter[] {
  return wizardFlagParameters(flags).filter((parameter) => !parameter.required)
}

/**
 * Normalizes a command's declared args into wizard parameters, skipping hidden
 * args and preserving the declared positional order.
 */
export function wizardArgParameters(args: {[name: string]: Command.Arg.Any}): WizardArgParameter[] {
  return Object.entries(args)
    .filter(([, arg]) => !arg.hidden)
    .map(([name, arg]) => ({
      name,
      kind: promptKindForArg(arg),
      description: firstLine(arg.description),
      options: toMutableOptions(arg.options),
      required: Boolean(arg.required),
    }))
}

/**
 * The required positional args the wizard must prompt for, in declared order.
 */
export function requiredArgParameters(args: {[name: string]: Command.Arg.Any}): WizardArgParameter[] {
  return wizardArgParameters(args).filter((parameter) => parameter.required)
}

/**
 * Validates free-text input as non-empty. Returns an error message when invalid,
 * or `undefined` when valid — matching cli-kit's `validate` contract.
 */
export function validateNonEmpty(value: string): string | undefined {
  if (value.trim().length === 0) return 'This value is required.'
}

/**
 * Validates that free-text input is an integer. Returns an error message when
 * invalid, or `undefined` when valid.
 */
export function validateInteger(value: string): string | undefined {
  if (!/^-?\d+$/.test(value.trim())) return 'Enter a whole number.'
}

function booleanDefault(flag: Command.Flag.Any): boolean | undefined {
  if (flag.type !== 'boolean') return undefined
  // A flag's `default` can be a function; the wizard only understands a literal.
  const value = (flag as {default?: unknown}).default
  return typeof value === 'boolean' ? value : undefined
}

function readGroupMembers(flag: Command.Flag.Any, kind: 'exactlyOne' | 'atLeastOne'): string[] | undefined {
  const value = (flag as {[key: string]: unknown})[kind]
  return Array.isArray(value) && value.length > 0 ? (value as string[]) : undefined
}

function isBoundedIntegerFlag(flag: Command.Flag.Any): boolean {
  const bounded = flag as {min?: unknown; max?: unknown}
  return typeof bounded.min === 'number' || typeof bounded.max === 'number'
}

function readFlagOptions(flag: Command.Flag.Any): ReadonlyArray<string> | undefined {
  return (flag as {options?: ReadonlyArray<string>}).options
}

function hasOptions(options: ReadonlyArray<string> | undefined): boolean {
  return Array.isArray(options) && options.length > 0
}

function toMutableOptions(options: ReadonlyArray<string> | undefined): string[] | undefined {
  return hasOptions(options) ? [...options!] : undefined
}

function firstLine(text: string | undefined): string | undefined {
  if (text === undefined) return undefined
  return (text.split('\n')[0] ?? '').trim()
}
