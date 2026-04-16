import Command, {type ArgOutput, type FlagOutput} from '@shopify/cli-kit/node/base-command'
import {addSensitiveMetadata} from '@shopify/cli-kit/node/metadata'

import type {Input, ParserOutput} from '@oclif/core/parser'

/**
 * Base class that includes shared behavior for all store commands.
 */
export default abstract class StoreCommand extends Command {
  public abstract run(): Promise<void>

  protected async parse<
    TFlags extends FlagOutput & {path?: string; verbose?: boolean},
    TGlobalFlags extends FlagOutput,
    TArgs extends ArgOutput,
  >(
    options?: Input<TFlags, TGlobalFlags, TArgs>,
    argv?: string[],
  ): Promise<ParserOutput<TFlags, TGlobalFlags, TArgs> & {argv: string[]}> {
    const result = await super.parse<TFlags, TGlobalFlags, TArgs>(options, argv)
    const storeFqdn = (result.flags as {store?: unknown}).store
    if (typeof storeFqdn === 'string' && storeFqdn.length > 0) {
      await addSensitiveMetadata(() => ({store_fqdn: storeFqdn}))
    }
    return result
  }
}
