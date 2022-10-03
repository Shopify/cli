import {errorHandler, registerCleanBugsnagErrorsFromWithinPlugins} from './error-handler.js'
import {isDevelopment} from '../environment/local.js'
import {addPublic} from '../metadata.js'
import {hashString} from '../string.js'
import {Command, Interfaces} from '@oclif/core'

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
    const result = await super.parse<TFlags, TGlobalFlags, TArgs>(options, argv)
    await addFromParsedFlags(result.flags)
    return result
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
