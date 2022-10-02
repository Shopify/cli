import {errorHandler, registerCleanBugsnagErrorsFromWithinPlugins} from './error-handler.js'
import {isDevelopment} from '../environment/local.js'
import {addPublic} from '../metadata.js'
import {content, info, token} from '../output.js'
import {hashString} from '../string.js'
import {loadPresetsFromDirectory} from '../public/node/presets.js'
import {Command, Interfaces} from '@oclif/core'

interface PresettableFlags {
  preset?: string
  path?: string
}

abstract class BaseCommand extends Command {
  public static analyticsNameOverride(): string | undefined {
    return undefined
  }

  async catch(error: Error & {exitCode?: number | undefined}) {
    await errorHandler(error, this.config)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected async init(): Promise<any> {
    if (!isDevelopment()) {
      // This function runs just prior to `run`
      await registerCleanBugsnagErrorsFromWithinPlugins(this.config)
    }
    return super.init()
  }

  protected async parse<
    TFlags extends Interfaces.FlagOutput & {path?: string; verbose?: boolean},
    TGlobalFlags extends Interfaces.FlagOutput,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    TArgs extends {[name: string]: any},
  >(
    options?: Interfaces.Input<TFlags, TGlobalFlags> | undefined,
    argv?: string[] | undefined,
  ): Promise<Interfaces.ParserOutput<TFlags, TGlobalFlags, TArgs>> {
    const rawResult = await super.parse<TFlags, TGlobalFlags, TArgs>(options, argv)
    const flags = rawResult.flags as PresettableFlags
    let result = rawResult
    if (flags.preset) {
      const presets = await loadPresetsFromDirectory(await this.presetsPath(flags), {findUp: this.findUpForPresets()})
      const preset = presets[flags.preset]
      if (preset) {
        const noDefaultsResult = await super.parse<TFlags, TGlobalFlags, TArgs>(noDefaultsOptions(options), argv)
        result = await super.parse<TFlags, TGlobalFlags, TArgs>(options, [
          ...(argv || this.argv),
          ...argsFromPreset<TFlags, TArgs>(preset, options, noDefaultsResult),
        ])
        reportDifferences(rawResult.flags, result.flags, flags.preset)
      }
    }
    await addFromParsedFlags(result.flags)
    return result
  }

  protected async presetsPath(_rawFlags: {path?: string}): Promise<string> {
    return process.cwd()
  }

  protected findUpForPresets(): boolean {
    return false
  }
}

export async function addFromParsedFlags(flags: {path?: string; verbose?: boolean}) {
  await addPublic(() => ({
    cmd_all_verbose: flags.verbose,
    cmd_all_path_override: flags.path !== undefined,
    cmd_all_path_override_hash: flags.path === undefined ? undefined : hashString(flags.path),
  }))
}

function reportDifferences(
  rawFlags: {[name: string]: unknown},
  flagsWithPresets: {[name: string]: unknown},
  preset: string,
): void {
  const changes: {[name: string]: unknown} = {}
  for (const [name, value] of Object.entries(flagsWithPresets)) {
    if (value !== rawFlags[name]) changes[name] = value
  }
  if (Object.keys(changes).length === 0) return
  info(content`Using applicable flags from the preset ${token.yellow(preset)}:

${Object.entries(changes)
  .map(([name, value]) => `• ${name} = ${value}`)
  .join('\n')}\n`)
}

function noDefaultsOptions<TFlags>(
  options: Interfaces.Input<TFlags> | undefined,
): Interfaces.Input<TFlags> | undefined {
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

function argsFromPreset<TFlags, TArgs>(
  preset: {[name: string]: unknown},
  options: Interfaces.Input<TFlags> | undefined,
  noDefaultsResult: Interfaces.ParserOutput<TFlags, TArgs>,
): string[] {
  const args: string[] = []
  for (const [label, value] of Object.entries(preset)) {
    const flagIsRelevantToCommand = options?.flags && Object.prototype.hasOwnProperty.call(options.flags, label)
    const userSpecifiedThisFlag =
      noDefaultsResult.flags && Object.prototype.hasOwnProperty.call(noDefaultsResult.flags, label)
    if (flagIsRelevantToCommand && !userSpecifiedThisFlag) {
      if (typeof value === 'boolean') {
        args.push(`--${value ? '' : 'no-'}${label}`)
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
