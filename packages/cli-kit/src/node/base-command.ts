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
    const presetsDirectory = await this.presetsPath(flags)
    const result = await super.parse<TFlags, TGlobalFlags, TArgs>(await withPresets(options, rawResult, presetsDirectory), argv)
    if (flags.preset) {
      reportDifferences(rawResult.flags, result.flags, flags.preset)
    }
    await addFromParsedFlags(result.flags)
    return result
  }

  protected async presetsPath(_rawFlags: {path?: string}): Promise<string> {
    return process.cwd()
  }
}

export default BaseCommand

export async function addFromParsedFlags(flags: {path?: string; verbose?: boolean}) {
  await addPublic(() => ({
    cmd_all_verbose: flags.verbose,
    cmd_all_path_override: flags.path !== undefined,
    cmd_all_path_override_hash: flags.path === undefined ? undefined : hashString(flags.path),
  }))
}

async function withPresets<TFlags extends PresettableFlags, TArgs extends {[name: string]: any}>(
  options: Interfaces.Input<TFlags> | undefined,
  rawResult: Interfaces.ParserOutput<TFlags, TArgs>,
  presetsDirectory: string
): Promise<Interfaces.Input<TFlags> | undefined> {
  const flags = rawResult.flags
  if (flags.preset) {
    const presets = await loadPresetsFromDirectory(presetsDirectory)
    const selectedPreset = presets[flags.preset]
    if (selectedPreset && options?.flags) {
      const newFlags = {...options.flags} as {[name: string]: object}
      for (const [k, v] of Object.entries(newFlags)) {
        if (selectedPreset.hasOwnProperty(k)) newFlags[k] = {...v, default: selectedPreset[k]}
      }
      return {...options, flags: newFlags} as typeof options
    }
  }
  return options
}

function reportDifferences(rawFlags: {[name: string]: any}, flagsWithPresets: {[name: string]: any}, preset: string): void {
  const changes: {[name: string]: any} = {}
  for (const [k, v] of Object.entries(flagsWithPresets)) {
    if (v !== rawFlags[k]) changes[k] = v
  }
  if (Object.keys(changes).length === 0) return
  info(content`Using applicable flags from the preset ${token.yellow(preset)}:

${Object.entries(changes).map(([k, v]) => `• ${k} = ${v}`).join('\n')}\n`)
}
