import {errorHandler, registerCleanBugsnagErrorsFromWithinPlugins} from './error-handler.js'
import {loadPresetsFromDirectory} from './presets.js'
import {isDevelopment} from './environment/local.js'
import {addPublicMetadata} from './metadata.js'
import {JsonMap} from '../../private/common/json.js'
import {Abort} from '../../error.js'
import {content, info, token} from '../../output.js'
import {hashString} from '../../public/node/crypto.js'
import {isTruthy} from '../../private/node/environment/utilities.js'
import {Command, Interfaces} from '@oclif/core'

interface PresettableFlags {
  preset?: string
  path?: string
}

abstract class BaseCommand extends Command {
  public static analyticsNameOverride(): string | undefined {
    return undefined
  }

  async catch(error: Error & {exitCode?: number | undefined}): Promise<void> {
    await errorHandler(error, this.config)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected async init(): Promise<any> {
    this.exitWithTimestampWhenEnvVariablePresent()
    if (!isDevelopment()) {
      // This function runs just prior to `run`
      await registerCleanBugsnagErrorsFromWithinPlugins(this.config)
    }
    return super.init()
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  protected exitWithTimestampWhenEnvVariablePresent() {
    if (isTruthy(process.env.SHOPIFY_CLI_ENV_STARTUP_PERFORMANCE_RUN)) {
      info(`
      SHOPIFY_CLI_TIMESTAMP_START
      { "timestamp": ${Date.now()} }
      SHOPIFY_CLI_TIMESTAMP_END
      `)
      process.exit(0)
    }
  }

  protected async parse<
    TFlags extends Interfaces.FlagOutput & {path?: string; verbose?: boolean},
    TGlobalFlags extends Interfaces.FlagOutput,
    TArgs extends Interfaces.OutputArgs,
  >(
    options?: Interfaces.Input<TFlags, TGlobalFlags>,
    argv?: string[],
  ): Promise<Interfaces.ParserOutput<TFlags, TGlobalFlags, TArgs>> {
    let result = await super.parse<TFlags, TGlobalFlags, TArgs>(options, argv)
    result = await this.resultWithPreset<TFlags, TGlobalFlags, TArgs>(result, options, argv)
    await addFromParsedFlags(result.flags)
    return result
  }

  protected async resultWithPreset<
    TFlags extends Interfaces.FlagOutput & {path?: string; verbose?: boolean},
    TGlobalFlags extends Interfaces.FlagOutput,
    TArgs extends Interfaces.OutputArgs,
  >(
    originalResult: Interfaces.ParserOutput<TFlags, TGlobalFlags, TArgs>,
    options?: Interfaces.Input<TFlags, TGlobalFlags>,
    argv?: string[],
  ): Promise<Interfaces.ParserOutput<TFlags, TGlobalFlags, TArgs>> {
    // If no preset is specified, don't modify the results
    const flags = originalResult.flags as PresettableFlags
    if (!flags.preset) return originalResult

    // If the specified preset isn't found, don't modify the results
    const presets = await loadPresetsFromDirectory(await this.presetsPath(flags), {findUp: this.findUpForPresets()})
    const preset = presets[flags.preset]
    if (!preset) return originalResult

    // Parse using noDefaultsOptions to derive a list of flags specified as
    // command-line arguments.
    const noDefaultsResult = await super.parse<TFlags, TGlobalFlags, TArgs>(noDefaultsOptions(options), argv)

    // Add the preset's settings to argv and pass them to `super.parse`. This
    // invokes oclif's validation system without breaking the oclif black box.
    // Replace the original result with this one.
    const result = await super.parse<TFlags, TGlobalFlags, TArgs>(options, [
      // Need to specify argv default because we're merging with argsFromPreset.
      ...(argv || this.argv),
      ...argsFromPreset<TFlags, TGlobalFlags, TArgs>(preset, options, noDefaultsResult),
    ])

    // Report successful application of the preset.
    reportPresetApplication<TFlags, TGlobalFlags, TArgs>(noDefaultsResult.flags, result.flags, flags.preset, preset)

    return result
  }

  protected async presetsPath(rawFlags: {path?: string}): Promise<string> {
    return rawFlags.path || process.cwd()
  }

  protected findUpForPresets(): boolean {
    return true
  }
}

export async function addFromParsedFlags(flags: {path?: string; verbose?: boolean}): Promise<void> {
  await addPublicMetadata(() => ({
    cmd_all_verbose: flags.verbose,
    cmd_all_path_override: flags.path !== undefined,
    cmd_all_path_override_hash: flags.path === undefined ? undefined : hashString(flags.path),
  }))
}

/**
 * Any flag which is:
 *
 * 1. Present in the final set of flags
 * 2. Specified in the preset
 * 3. Not specified by the user as a command line argument
 *
 * should be reported.
 *
 * It doesn't matter if the preset flag's value was the same as the default; from
 * the user's perspective, they want to know their preset was applied.
 */
function reportPresetApplication<
  TFlags extends Interfaces.FlagOutput,
  TGlobalFlags extends Interfaces.FlagOutput,
  TArgs extends Interfaces.OutputArgs,
>(
  noDefaultsFlags: Interfaces.ParserOutput<TFlags, TGlobalFlags, TArgs>['flags'],
  flagsWithPresets: Interfaces.ParserOutput<TFlags, TGlobalFlags, TArgs>['flags'],
  presetName: string,
  preset: JsonMap,
): void {
  const changes: JsonMap = {}
  for (const [name, value] of Object.entries(flagsWithPresets)) {
    const userSpecifiedThisFlag = Object.prototype.hasOwnProperty.call(noDefaultsFlags, name)
    const presetContainsFlag = Object.prototype.hasOwnProperty.call(preset, name)
    if (!userSpecifiedThisFlag && presetContainsFlag) changes[name] = value
  }
  if (Object.keys(changes).length === 0) return
  info(content`Using applicable flags from the preset ${token.yellow(presetName)}:

${Object.entries(changes)
  .map(([name, value]) => `• ${name} = ${value}`)
  .join('\n')}\n`)
}

/**
 * Strips the defaults from configured flags. For example, if flags contains:
 *
 * ```
 *   someFlag: Flags.boolean({
 *     description: 'some flag',
 *     default: false
 *   })
 * ```
 *
 * it becomes:
 *
 * ```
 *   someFlag: Flags.boolean({
 *     description: 'some flag'
 *   })
 * ```
 *
 * If we parse using this configuration, the only specified flags will be those
 * the user actually passed on the command line.
 */
function noDefaultsOptions<TFlags extends Interfaces.FlagOutput, TGlobalFlags extends Interfaces.FlagOutput>(
  options: Interfaces.Input<TFlags, TGlobalFlags> | undefined,
): Interfaces.Input<TFlags, TGlobalFlags> | undefined {
  if (!options?.flags) return options
  return {
    ...options,
    flags: Object.fromEntries(
      Object.entries(options.flags).map(([label, settings]) => {
        const copiedSettings = {...(settings as {default?: unknown})}
        delete copiedSettings.default
        return [label, copiedSettings]
      }),
    ) as Interfaces.FlagInput<TFlags>,
  }
}

/**
 * Converts the preset's settings to arguments as though passed on the command
 * line, skipping any arguments the user specified on the command line.
 */
function argsFromPreset<
  TFlags extends Interfaces.FlagOutput,
  TGlobalFlags extends Interfaces.FlagOutput,
  TArgs extends Interfaces.OutputArgs,
>(
  preset: JsonMap,
  options: Interfaces.Input<TFlags, TGlobalFlags> | undefined,
  noDefaultsResult: Interfaces.ParserOutput<TFlags, TArgs>,
): string[] {
  const args: string[] = []
  for (const [label, value] of Object.entries(preset)) {
    const flagIsRelevantToCommand = options?.flags && Object.prototype.hasOwnProperty.call(options.flags, label)
    const userSpecifiedThisFlag =
      noDefaultsResult.flags && Object.prototype.hasOwnProperty.call(noDefaultsResult.flags, label)
    if (flagIsRelevantToCommand && !userSpecifiedThisFlag) {
      if (typeof value === 'boolean') {
        if (value === true) {
          args.push(`--${label}`)
        } else {
          throw new Abort(
            content`Presets can only specify true for boolean flags. Attempted to set ${token.yellow(label)} to false.`,
          )
        }
      } else if (Array.isArray(value)) {
        value.forEach((element) => args.push(`--${label}`, `${element}`))
      } else {
        args.push(`--${label}`, `${value}`)
      }
    }
  }
  return args
}

export default BaseCommand
