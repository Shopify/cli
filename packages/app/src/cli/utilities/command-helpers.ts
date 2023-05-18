import Command from './app-command.js'
import {appFlags} from '../flags.js'
import {load as loadApp} from '../models/app/loader.js'
import {resolvePath, cwd} from '@shopify/cli-kit/node/path'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import type {AppInterface} from '../models/app/app.js'
import type {Config} from '@oclif/core'
import type {FlagOutput, ParserOutput, FlagInput, ArgOutput} from '@oclif/core/lib/interfaces/parser.js'

interface BuiltInFlags {
  preset?: string
  verbose: boolean
  path: string
  environment?: string
}

/**
 * Given something like `[{key: 'foo', ask: () => Promise.resolve('abc')}, {key: 'bar', ask: () => Promise.resolve(1)}]`, produces `{foo: string, bar: number}`
 */
type PromptListAsObject<T extends ReadonlyArray<{key: string; ask: () => Promise<unknown>}>> = {
  [K in T[number] as K['key']]: Awaited<ReturnType<K['ask']>>
}

/**
 * A function that converts post-parsing flags from one structure to another
 *
 * @typeParam TIn - Shape of input flags, post-parsing
 * @typeParam TOut - Shape of output flags
 */
type ParsedFlagProcessor<TIn extends FlagOutput, TOut extends FlagOutput> = (
  flags: ParserOutput<TIn, ArgOutput>['flags'],
) => Promise<ParserOutput<TOut, ArgOutput>['flags']>

/**
 * A flag processor that extends the input flags, based on a list of prompt functions
 */
type PromptBasedFlagProcessor<
  TIn extends FlagOutput,
  TPromptList extends ReadonlyArray<{key: string; ask: () => Promise<unknown>}>,
> = ParsedFlagProcessor<TIn, PromptListAsObject<TPromptList> & TIn>

/**
 * Takes a collection of parsed flags, applies the prompts for values not given via a flag, and returns the combined data set
 *
 * @param options - List of prompts to use for anything not provided via a flag. It's best to give this with `as const`
 * @returns Parsed flag outputs, with prompts applied if necessary
 */
export function askFor<
  TIn extends FlagOutput,
  TPromptList extends ReadonlyArray<{key: string; ask: () => Promise<unknown>}>,
  TExtension = PromptListAsObject<TPromptList>,
>(options: TPromptList): PromptBasedFlagProcessor<TIn, TPromptList> {
  return async (flags) => {
    const answers = {} as TExtension
    for (const {key, ask} of options) {
      if (flags[key] === undefined || flags[key] === null) {
        // eslint-disable-next-line no-await-in-loop
        const answer = (await ask()) as TExtension[keyof TExtension]
        answers[key as keyof TExtension] = answer
      }
    }
    const res: ParserOutput<TIn & TExtension, ArgOutput>['flags'] = {
      ...flags,
      ...answers,
    }
    return res
  }
}

type ConcreteCommand = new (argv: string[], config: Config) => Command

/**
 * Creates a command class, using our preferred patterns
 *
 * @param description - Description for the command
 * @param flags - Command flags
 * @param applyPrompts - Function that takes the flags, post-parsing, and applies extra values, usually via prompts
 * @param runService - Service function that does the work of the command
 * @returns Whatever the service function returns
 */
export function command<TFlags extends FlagOutput, TServiceOptions extends TFlags = TFlags>(
  description: string,
  flags: FlagInput<TFlags>,
  applyPrompts: ParsedFlagProcessor<TFlags & BuiltInFlags, TServiceOptions & BuiltInFlags>,
  runService: (app: AppInterface, options: TServiceOptions & BuiltInFlags) => Promise<unknown>,
): ConcreteCommand {
  const builtInFlagInput: FlagInput<BuiltInFlags> = {
    ...globalFlags,
    ...appFlags,
  }
  class CustomCommand extends Command {
    static description = description
    static flags = {
      ...builtInFlagInput,
      ...flags,
    } as FlagInput<TFlags & BuiltInFlags>

    public async run(): Promise<unknown> {
      const {flags} = await this.parse<TFlags & BuiltInFlags, FlagOutput, ArgOutput>(CustomCommand)
      const directory = flags.path ? resolvePath(flags.path) : cwd()

      const app: AppInterface = await loadApp({directory, specifications: []})

      const finalOptions = await applyPrompts(flags)

      return runService(app, finalOptions)
    }
  }
  return CustomCommand
}
