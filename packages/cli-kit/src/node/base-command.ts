import {errorHandler, registerCleanBugsnagErrorsFromWithinPlugins} from './error-handler.js'
import {findUp} from '../path.js'
import {read as fileRead} from '../file.js'
import {decode as decodeTOML} from '../toml.js'
import {isDebug} from '../environment/local.js'
import {Command, Interfaces} from '@oclif/core'

// eslint-disable-next-line import/no-anonymous-default-export
export default abstract class extends Command {
  async catch(error: Error & {exitCode?: number | undefined}) {
    errorHandler(error)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected async init(): Promise<any> {
    if (!isDebug()) {
      // This function runs just prior to `run`
      registerCleanBugsnagErrorsFromWithinPlugins(this.config.plugins)
    }
    return super.init()
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected async parseWithPresets<TF, TA extends {[name: string]: any}>(
    options?: Interfaces.Input<TF>,
    argv?: string[],
  ): Promise<
    Omit<Interfaces.ParserOutput<TF, TA>, 'flags' | 'args'> & {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      flags: {[name: string]: any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      args: {[name: string]: any}
    }
  > {
    const parsed = await super.parse(options, argv)
    const flags = {...(await presets(parsed.flags)), ...parsed.flags}
    return {...parsed, flags}
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function presets(flags: {[name: string]: any}): Promise<{[name: string]: any}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let retval: {[name: string]: any} = {}
  if (!flags.preset) return retval
  const presetsFile = await findUp('shopify.presets.toml', {
    type: 'file',
    cwd: flags.path ?? '.',
  })
  if (presetsFile) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const presetSettings: {[name: string]: any} = decodeTOML(await fileRead(presetsFile))
    if (typeof presetSettings[flags.preset] === 'object') retval = {retval, ...presetSettings[flags.preset]}
  }
  return retval
}
