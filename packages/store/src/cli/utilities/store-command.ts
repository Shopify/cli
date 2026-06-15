import {resolveStore} from './store-resolution.js'
import Command, {ArgOutput, FlagOutput} from '@shopify/cli-kit/node/base-command'
import {Input, ParserOutput} from '@oclif/core/parser'

/**
 * Base class that includes shared behavior for all store commands.
 */
export default abstract class StoreCommand extends Command {
  public abstract run(): Promise<void>

  // Resolve `--store` AFTER oclif has parsed and validated every other flag. Doing the
  // auth+network resolution here (rather than in the flag's `parse`) means unknown/required/
  // exclusive flag errors are reported before we ever reach out to the Business Platform, so
  // users don't get surprising auth prompts ahead of a plain flag-validation error.
  protected async parse<
    TFlags extends FlagOutput & {path?: string; verbose?: boolean},
    TGlobalFlags extends FlagOutput,
    TArgs extends ArgOutput,
  >(
    options?: Input<TFlags, TGlobalFlags, TArgs>,
    argv?: string[],
  ): Promise<ParserOutput<TFlags, TGlobalFlags, TArgs> & {argv: string[]}> {
    const result = await super.parse<TFlags, TGlobalFlags, TArgs>(options, argv)
    const flags = result?.flags as {store?: unknown} | undefined
    if (flags && typeof flags.store === 'string') {
      flags.store = await resolveStore(flags.store)
    }
    return result
  }
}
