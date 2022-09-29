import Command from '@shopify/cli-kit/node/base-command'
import {loadPresetsFromDirectory} from '@shopify/cli-kit/node/presets'
import {output} from '@shopify/cli-kit'
import {Interfaces} from '@oclif/core'

export default abstract class AppCommand extends Command {
  protected async parse<TFlags extends {path?: string; verbose?: boolean}, TArgs extends {[name: string]: any}>(
    options?: Interfaces.Input<TFlags> | undefined,
    argv?: string[] | undefined,
  ): Promise<Interfaces.ParserOutput<TFlags, TArgs>> {
    const rawResult = await super.parse<TFlags, TArgs>(options, argv)
    const result = await super.parse<TFlags, TArgs>(await withPresets(options, rawResult), argv)
    const flags = rawResult.flags as {preset?: string}
    if (flags.preset) {
      reportDifferences(rawResult.flags, result.flags, flags.preset)
    }
    return result
  }
}

async function withPresets<TFlags extends {path?: string, preset?: string}, TArgs extends {[name: string]: any}>(
  options: Interfaces.Input<TFlags> | undefined,
  rawResult: Interfaces.ParserOutput<TFlags, TArgs>
): Promise<Interfaces.Input<TFlags> | undefined> {
  const flags = rawResult.flags
  if (flags.preset) {
    const presets = await loadPresetsFromDirectory(flags.path ? flags.path : process.cwd())
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
  output.info(output.content`Using applicable flags from the preset ${output.token.yellow(preset)}:

${Object.entries(changes).map(([k, v]) => `• ${k} = ${v}`).join('\n')}\n`)
}
