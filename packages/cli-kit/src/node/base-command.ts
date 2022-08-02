import {errorHandler, registerCleanBugsnagErrorsFromWithinPlugins} from './error-handler.js'
import {findUp, join as pathJoin} from '../path.js'
import {exists as fileExists, read as fileRead} from '../file.js'
import {decode as decodeTOML} from '../toml.js'
import {homeDirectory, isDebug} from '../environment/local.js'
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
  if (!flags.preset) return {}
  const globalPresetsFile = pathJoin(homeDirectory(), 'shopify.presets.toml')
  const localPresetsFile = await findUp('shopify.presets.toml', {
    type: 'file',
    cwd: flags.path ?? '.',
  })
  return {
    ...(await presetsFromFile(globalPresetsFile, flags.preset)),
    ...(await presetsFromFile(localPresetsFile, flags.preset)),
  }
}

async function presetsFromFile(
  filepath: string | undefined,
  presetName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{[name: string]: any}> {
  if (filepath && (await fileExists(filepath))) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const presetSettings: {[name: string]: any} = decodeTOML(await fileRead(filepath))
    if (typeof presetSettings[presetName] === 'object') return presetSettings[presetName]
  }
  return {}
}
