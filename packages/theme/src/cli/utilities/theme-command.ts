import {configurationFileName} from '../constants.js'
import {ArgOutput, FlagOutput, Input} from '@oclif/core/lib/interfaces/parser.js'
import Command from '@shopify/cli-kit/node/base-command'
import {loadEnvironment} from '@shopify/cli-kit/node/environments'
import {renderInfo} from '@shopify/cli-kit/node/ui'

export interface FlagValues {
  [key: string]: boolean | string | string[] | number | undefined
}
interface PassThroughFlagsOptions {
  // Only pass on flags that are relevant to CLI2
  allowedFlags?: string[]
}

export default abstract class ThemeCommand extends Command {
  passThroughFlags(flags: FlagValues, {allowedFlags}: PassThroughFlagsOptions): string[] {
    const passThroughFlags: string[] = []
    for (const [label, value] of Object.entries(flags)) {
      if (!(allowedFlags ?? []).includes(label)) {
        continue
      } else if (typeof value === 'boolean') {
        if (value) passThroughFlags.push(`--${label}`)
      } else if (Array.isArray(value)) {
        value.forEach((element) => passThroughFlags.push(`--${label}`, element))
      } else {
        passThroughFlags.push(`--${label}`, `${value}`)
      }
    }
    return passThroughFlags
  }

  environmentsFilename(): string {
    return configurationFileName
  }

  async runCommand<TFlags extends FlagOutput & {path?: string; verbose?: boolean}>(_flags: TFlags): Promise<void> {}

  async run<
    TFlags extends FlagOutput & {path?: string; verbose?: boolean},
    TGlobalFlags extends FlagOutput,
    TArgs extends ArgOutput,
  >(options?: Input<TFlags, TGlobalFlags, TArgs>): Promise<void> {
    const flagsEnv = await this.parseEnvironments(options)

    for (const flags of flagsEnv) {
      renderInfo({
        headline: ['Using applicable flags from', {userInput: flags.environment}, 'environment:'],
      })

      // eslint-disable-next-line no-await-in-loop
      await this.runCommand(flags)
    }
  }

  protected async parseEnvironments<
    TFlags extends FlagOutput & {path?: string; verbose?: boolean},
    TGlobalFlags extends FlagOutput,
    TArgs extends ArgOutput,
  >(options?: Input<TFlags, TGlobalFlags, TArgs>, argv?: string[]): Promise<TFlags[]> {
    const result = await this.parse<TFlags, TGlobalFlags, TArgs>(options, argv)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flags = result.flags as any
    const resultFlags = []
    let environments = flags.environment ?? []
    if (!Array.isArray(environments)) {
      environments = [environments]
    }

    for (const env of environments) {
      // eslint-disable-next-line no-await-in-loop
      resultFlags.push({...(await loadEnvironment(env, 'shopify.theme.toml', {from: flags.path})), environment: env})
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return resultFlags as any
  }
}
