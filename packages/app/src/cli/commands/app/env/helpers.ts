import {appFlags} from '../../../flags.js'
import {AppInterface} from '../../../models/app/app.js'
import {load as loadApp} from '../../../models/app/loader.js'
import Command from '../../../utilities/app-command.js'
import {Interfaces} from '@oclif/core'
import {path, cli} from '@shopify/cli-kit'

interface BuiltInFlags {
  preset?: string
  verbose?: boolean
  path?: string
}

type PromptHandler<TIn extends BuiltInFlags, TOut extends BuiltInFlags = TIn> = (
  flags: Interfaces.ParserOutput<TIn, Interfaces.OutputArgs>['flags'],
) => Promise<Interfaces.ParserOutput<TOut, Interfaces.OutputArgs>['flags']>

type PromptListAsObject<T extends ReadonlyArray<{key: string; promptFn: () => Promise<unknown>}>> = {
  [K in T[number] as K['key']]: Awaited<ReturnType<K['promptFn']>>
}

export function noPrompt<TIn extends {[key: string]: unknown}>(): PromptHandler<
  TIn,
  TIn & BuiltInFlags & {json: boolean | undefined}
> {
  return async (flags: TIn & BuiltInFlags & {json: boolean | undefined}) => {
    return {...flags}
  }
}

export function promptFor<
  TIn extends {[key: string]: unknown},
  TOptions extends ReadonlyArray<{key: string; promptFn: () => Promise<unknown>}>,
>(
  options: TOptions,
): PromptHandler<TIn, TIn & BuiltInFlags & {json: boolean | undefined} & PromptListAsObject<TOptions>> {
  return async (flags: TIn & BuiltInFlags & {json: boolean | undefined}) => {
    const answers = {} as {[key: string]: unknown}
    for (const {key, promptFn} of options) {
      if (flags[key] === undefined || flags[key] === null) {
        // eslint-disable-next-line no-await-in-loop
        answers[key] = await promptFn()
      }
    }
    const res: TIn & BuiltInFlags & {json: boolean | undefined} & PromptListAsObject<TOptions> = {
      ...flags,
      ...(answers as PromptListAsObject<TOptions>),
    }
    return res
  }
}

// This is needed so that the return type of `command` is a real, public, thing in `d.ts` files.
export class DeclarativeCommand extends Command {
  public async run(): Promise<void> {}
}

export function command<TFlags, TServiceOptions = TFlags>(
  description: string,
  flags: Interfaces.FlagInput<TFlags>,
  applyPrompts: PromptHandler<TFlags, TServiceOptions>,
  runService: (app: AppInterface, options: TServiceOptions) => Promise<void>,
): typeof DeclarativeCommand {
  class CustomCommand extends DeclarativeCommand {
    static description = description
    static flags = {
      ...cli.globalFlags,
      ...appFlags,
      ...flags,
    }

    public async run(): Promise<void> {
      const {flags} = await this.parse<
        Interfaces.FlagOutput & {path?: string; verbose?: boolean; preset?: string} & TFlags,
        Interfaces.OutputArgs
      >(CustomCommand)
      const directory = flags.path ? path.resolve(flags.path) : process.cwd()

      const app: AppInterface = await loadApp(directory)

      const finalOptions = await applyPrompts(flags)

      await runService(app, finalOptions)
    }
  }
  return CustomCommand
}
